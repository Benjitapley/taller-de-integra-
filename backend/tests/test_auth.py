from datetime import datetime, timedelta, timezone
from copy import deepcopy
from decimal import Decimal
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi import HTTPException
from backend.auth_service import main as auth, security, email_service, database
from backend.auth_service.config import get_settings
from backend.match_conexion_service import routes as connections
from backend.main import main as web


def register(client, payload):
    return client.post("/auth/registro", json=payload)


def verified_login(client, payload, mail):
    assert register(client, payload).status_code == 200
    response = client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": mail[-1][2]})
    assert response.status_code == 200
    login = client.post("/auth/login", json={k: payload[k] for k in ("correo", "contrasena")})
    assert login.status_code == 200
    return {"Authorization": "Bearer " + login.json()["access_token"]}


def test_registration_hash_and_commit_before_smtp(client, payload, db, monkeypatch):
    def delivered(correo, nombre, code):
        assert db.outcomes[-1] == "commit"
        assert db.codes[1]["enviado_en"] is None
        assert len(code) == 6 and code.isascii() and code.isdigit()
        assert db.codes[1]["codigo_hash"] == email_service.huella_codigo(1, code)
        return True
    monkeypatch.setattr(auth, "enviar_codigo_verificacion", delivered)
    response = register(client, payload)
    assert response.status_code == 200
    assert response.json()["verificacion_pendiente"] is True
    assert "access_token" not in response.json()
    assert not response.cookies
    assert security.verify_password(payload["contrasena"], db.users[1]["contrasena"])
    assert db.users[1]["contrasena"] != payload["contrasena"]
    assert db.codes[1]["enviado_en"] is not None
    assert len(db.codes[1]["codigo_hash"]) == 64


def test_repeated_registration_does_not_change_credentials(client, payload, db, mail, monkeypatch):
    assert register(client, payload).status_code == 200
    original = deepcopy(db.users[1])
    db.codes[1]["creado_en"] -= timedelta(minutes=2)
    attacker = {**payload, "nombre": "Otro nombre", "contrasena": "otra-clave", "fecha_nacimiento": "1990-01-01"}
    assert register(client, attacker).status_code == 200
    assert db.users[1] == original
    assert db.codes[1]["usado"] is True
    assert mail[-1][1] == original["nombre"]
    assert not any("update haycupo.usuario set contrasena" in q for q, _ in db.calls)


@pytest.mark.parametrize("field,value,status", [("fecha_nacimiento", "2020-01-01", 400), ("contrasena", "123", 400), ("correo", "incorrecto", 422), ("nombre", "   ", 422)])
def test_registration_validation(client, payload, db, field, value, status):
    assert register(client, {**payload, field: value}).status_code == status
    assert not db.users


def test_commit_failure_never_sends_mail(client, payload, db, mail, monkeypatch):
    original = db.connect
    def connect():
        conn = original()
        execute = conn.execute
        def fail(sql, params=()):
            if "INSERT INTO haycupo.codigo_verificacion" in sql:
                raise RuntimeError("diagnóstico interno que no debe salir")
            return execute(sql, params)
        conn.execute = fail
        return conn
    monkeypatch.setattr(database, "conectar", connect)
    response = register(client, payload)
    assert response.status_code == 503
    assert "diagnóstico" not in response.text
    assert not mail and not db.users
    assert db.outcomes[-1] == "rollback"


def test_failed_smtp_keeps_account_and_invalidates_code(client, payload, db, monkeypatch):
    monkeypatch.setattr(auth, "enviar_codigo_verificacion", lambda *args: False)
    assert register(client, payload).status_code == 503
    assert db.users[1]["verificado"] is False
    assert db.codes[1]["usado"] is True
    assert db.codes[1]["enviado_en"] is None


def test_verification_and_logout_revoke_real_test_jwt(client, payload, db, mail):
    headers = verified_login(client, payload, mail)
    assert db.users[1]["verificado"] is True
    assert db.codes[1]["usado"] is True
    assert client.get("/api/perfil", headers=headers).status_code == 200
    assert client.post("/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/perfil", headers=headers).status_code == 401
    assert client.post("/auth/logout", headers=headers).status_code == 401


def test_wrong_attempts_commit_and_block_after_five(client, payload, db, mail):
    assert register(client, payload).status_code == 200
    wrong = "000000" if mail[-1][2] != "000000" else "111111"
    for attempt in range(1, 6):
        response = client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": wrong})
        assert response.status_code == (429 if attempt == 5 else 400)
        assert db.codes[1]["intentos"] == attempt
        assert db.outcomes[-1] == "commit"
    assert db.codes[1]["usado"] is True and not db.users[1]["verificado"]
    assert client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": mail[-1][2]}).status_code == 400


def test_expired_code_consumption_commits(client, payload, db, mail):
    register(client, payload)
    db.codes[1]["expira_en"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    response = client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": mail[-1][2]})
    assert response.status_code == 400
    assert db.codes[1]["usado"] is True and db.outcomes[-1] == "commit"


def test_undelivered_code_cannot_verify(client, payload, db, mail):
    register(client, payload)
    db.codes[1]["enviado_en"] = None
    assert client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": mail[-1][2]}).status_code == 400


@pytest.mark.parametrize("code", ["12345", "1234567", "１２３４５６", "12345\n", "123456\n", " 12345", "abc123"])
def test_code_format(client, payload, code):
    assert client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": code}).status_code == 422


def test_resend_cooldown_and_hourly_limit(client, payload, db, mail):
    register(client, payload)
    data = {"correo": payload["correo"]}
    assert client.post("/auth/reenviar-codigo", json=data).status_code == 429
    assert len(mail) == 1
    for _ in range(4):
        for code in db.codes.values():
            code["creado_en"] -= timedelta(seconds=61)
        assert client.post("/auth/reenviar-codigo", json=data).status_code == 200
    for code in db.codes.values():
        code["creado_en"] -= timedelta(seconds=61)
    assert client.post("/auth/reenviar-codigo", json=data).status_code == 429
    assert len(mail) == 5


def test_missing_account_and_unverified_login(client, payload, db, mail):
    login = {k: payload[k] for k in ("correo", "contrasena")}
    assert client.post("/auth/login", json=login).status_code == 401
    assert client.post("/auth/reenviar-codigo", json={"correo": payload["correo"]}).status_code == 404
    register(client, payload)
    assert client.post("/auth/login", json=login).status_code == 403
    assert client.post("/auth/login", json={**login, "contrasena": "incorrecta"}).status_code == 401


def test_plaintext_password_is_never_accepted(client, payload, db):
    db.users[7] = {**payload, "verificado": True}
    assert client.post("/auth/login", json={k: payload[k] for k in ("correo", "contrasena")}).status_code == 401
    assert not db.sessions


def test_account_removed_or_unverified_invalidates_session(client, payload, db, mail):
    headers = verified_login(client, payload, mail)
    db.users[1]["verificado"] = False
    assert client.get("/api/perfil", headers=headers).status_code == 401
    db.users.pop(1)
    assert client.get("/api/perfil", headers=headers).status_code == 401


def test_missing_secret_and_disabled_auth_fail_closed(client, monkeypatch, db):
    monkeypatch.delenv("JWT_SECRET_KEY")
    get_settings.cache_clear()
    assert client.get("/api/perfil").status_code == 503
    monkeypatch.setenv("AUTH_JWT_ENABLED", "false")
    get_settings.cache_clear()
    assert client.post("/auth/login", json={"correo": "validacion@example.com", "contrasena": "solo-test"}).status_code == 503
    assert not db.calls


@pytest.mark.parametrize("mutate", [
    lambda c: c.pop("exp"), lambda c: c.pop("sub"), lambda c: c.pop("jti"),
    lambda c: c.update(sub="otro"), lambda c: c.update(sub="0"),
    lambda c: c.update(sub="-1"), lambda c: c.update(sub="01"),
    lambda c: c.update(sub="9223372036854775808"), lambda c: c.update(jti="invalid"),
    lambda c: c.update(iss="otro-emisor"), lambda c: c.update(aud="otra-api"),
    lambda c: c.update(exp=1), lambda c: c.update(iat="texto"),
])
def test_invalid_jwt_claims(mutate):
    token, claims = security.create_access_token(1)
    mutate(claims)
    signed = jwt.encode(claims, get_settings().jwt_secret, algorithm="HS256")
    with pytest.raises(HTTPException) as error:
        security.decode_access_token(signed)
    assert error.value.status_code == 401


def test_signature_algorithm_and_malformed_tokens():
    token, claims = security.create_access_token(1)
    bad = ["demo_cookie_token", "a.b.c", token + "x",
           jwt.encode(claims, "unrelated-key-used-only-in-tests-123456", algorithm="HS256"),
           jwt.encode(claims, get_settings().jwt_secret, algorithm="HS384")]
    for value in bad:
        with pytest.raises(HTTPException) as error:
            security.decode_access_token(value)
        assert error.value.status_code == 401
    assert security.decode_access_token(token)["sub"] == "1"


@pytest.mark.parametrize("method,path,json", [
    ("get", "/api/perfil", None), ("put", "/api/perfil", None),
    ("get", "/api/mis-publicaciones", None), ("post", "/api/publicaciones", None),
    ("get", "/api/publicaciones/8", None),
    ("put", "/api/publicaciones/8", None), ("delete", "/api/publicaciones/8", None),
    ("post", "/conexiones/", {"id_solicitante_FK": 1, "id_receptor_FK": 2}),
    ("put", "/conexiones/8", {"estado": "Aceptada"}),
    ("get", "/conexiones/recibidas/1", None),
])
def test_private_routes_reject_cookie_id(client, db, method, path, json):
    response = client.request(method, path, json=json, headers={"Cookie": "roomies_id=1"})
    assert response.status_code == 401
    assert not db.calls


def test_public_read_and_static_routes_preserved(client):
    assert client.get("/api/publicaciones").json() == []
    assert client.get("/inicio").status_code == 200
    assert client.get("/Iconos/casa.webp").status_code == 200


def test_publication_search_filters_are_bound_parameters(client, db):
    response = client.get("/api/publicaciones", params={
        "consulta": "Centro%'; --", "precio_min": "100", "precio_max": "900",
        "cupos_min": "2", "categoria": "ofrezco", "tipo_vivienda": "departamento",
        "mascota": "si",
    })
    assert response.status_code == 200
    sql, params = db.calls[-1]
    assert "p.titulo ilike %s" in sql and "p.precio >= %s" in sql
    assert "p.cupos_totales >= %s" in sql and "p.mascota = %s" in sql
    assert "select i.url from haycupo.imagen_publicacion" in sql
    assert params == ("%Centro%'; --%", "%Centro%'; --%", "%Centro%'; --%", Decimal("100"), Decimal("900"), 2, "ofrezco", "departamento", "si")


def test_cross_user_delete_cannot_remove_images(client, payload, db, mail):
    headers = verified_login(client, payload, mail)
    db.publications[99] = 42
    assert client.delete("/api/publicaciones/99", headers=headers).status_code == 404
    assert db.images_deleted is False and db.publications[99] == 42
    db.publications[99] = 1
    assert client.delete("/api/publicaciones/99", headers=headers).status_code == 200
    assert db.images_deleted is True


def test_cross_user_connection_permissions():
    db = MagicMock()
    with pytest.raises(HTTPException) as err:
        connections.enviar_solicitud(connections.ConexionCreate(id_solicitante_FK=2, id_receptor_FK=3), 1, db)
    assert err.value.status_code == 403
    db.query.assert_not_called()
    with pytest.raises(HTTPException) as err:
        connections.ver_solicitudes_recibidas(2, 1, db)
    assert err.value.status_code == 403
    db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = MagicMock(id_receptor_FK=2)
    with pytest.raises(HTTPException) as err:
        connections.responder_solicitud(1, connections.ConexionUpdate(estado="Aceptada"), 1, db)
    assert err.value.status_code == 403
    db.commit.assert_not_called()


def test_smtp_adapter_uses_tls_without_real_network(monkeypatch):
    for name, value in {"SMTP_HOST": "smtp.example.invalid", "SMTP_USER": "sender@example.com", "SMTP_PASSWORD": "synthetic-test-only"}.items():
        monkeypatch.setenv(name, value)
    smtp = MagicMock()
    monkeypatch.setattr(email_service.smtplib, "SMTP", smtp)
    assert email_service.enviar_codigo_verificacion("recipient@example.com", "Nombre", "012345")
    server = smtp.return_value.__enter__.return_value
    server.starttls.assert_called_once()
    message = server.send_message.call_args.args[0]
    assert "012345" not in message["Subject"]
    assert "012345" in message.get_content()


def test_publication_create_update_and_profile_contracts(client, payload, mail, db):
    headers = verified_login(client, payload, mail)
    data = {"titulo": "Publicación aislada", "categoria": "ofrezco", "ubicacion": "Ciudad",
            "precio": "1000", "tipo": "Compartida", "cupos_totales": "2",
            "tipo_vivienda": "habitacion", "descripcion": "Solo prueba en memoria"}
    created = client.post("/api/publicaciones", headers=headers, data=data)
    assert created.status_code == 201
    assert created.json() == {"id": 1, "mensaje": "Publicación creada"}
    assert client.put("/api/publicaciones/1", headers=headers, data=data).status_code == 200
    db.publications[1] = 99
    assert client.put("/api/publicaciones/1", headers=headers, data=data).status_code == 404
    profile = client.get("/api/perfil", headers=headers)
    assert profile.status_code == 200
    assert set(profile.json()) == {"nombre", "edad", "ocupacion", "ciudad", "breve_descripcion", "sobre_mi", "foto_perfil", "total_publicaciones", "verificado"}
    assert client.put("/api/perfil", headers=headers, data={"ciudad": "Ciudad"}).json() == {"mensaje": "Perfil actualizado permanentemente"}


def test_zero_prefixed_code_and_duplicate_verified_account(client, payload, db, mail, monkeypatch):
    monkeypatch.setattr(auth, "generar_codigo", lambda: "012345")
    assert register(client, payload).status_code == 200
    assert mail[-1][2] == "012345"
    assert client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": "012345"}).status_code == 200
    assert register(client, payload).status_code == 409


def test_config_rejects_short_equal_secrets_or_other_algorithm(monkeypatch):
    for settings in [{"JWT_SECRET_KEY": "short"}, {"AUTH_CODE_SECRET": get_settings().jwt_secret}, {"JWT_ALGORITHM": "none"}]:
        with monkeypatch.context() as context:
            for key, value in settings.items():
                context.setenv(key, value)
            get_settings.cache_clear()
            with pytest.raises(RuntimeError):
                get_settings()
        get_settings.cache_clear()


def test_models_keep_response_aliases_without_creating_tables():
    from backend.match_conexion_service.models import Usuario, Publicacion
    assert Usuario.id_usuario_PK.property.columns[0].name == "id_usuario"
    assert Publicacion.id_publicacion_PK.property.columns[0].name == "id_publicacion"
    assert Publicacion.mascotas.property.columns[0].name == "mascota"
    assert Usuario.__table__.schema == "haycupo"


def test_connection_response_permissions_and_search_contracts(client, payload, mail, monkeypatch):
    from backend.match_conexion_service.database import get_db
    headers = verified_login(client, payload, mail)
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.all.return_value = []
    web.app.dependency_overrides[get_db] = lambda: db
    try:
        assert client.post("/conexiones/", headers=headers, json={"id_solicitante_FK": 2, "id_receptor_FK": 3}).status_code == 403
        assert client.get("/conexiones/recibidas/2", headers=headers).status_code == 403
        assert client.get("/conexiones/recibidas/1", headers=headers).json() == []
        assert client.get("/conexiones/publicaciones/buscar").json() == []
        assert client.get("/conexiones/usuarios/buscar").json() == []
    finally:
        web.app.dependency_overrides.clear()


def test_sensitive_validation_input_is_not_echoed(client, payload):
    secret_input = "x" * 1025
    response = register(client, {**payload, "contrasena": secret_input})
    assert response.status_code == 422
    assert secret_input not in response.text
    assert all("input" not in error for error in response.json()["detail"])
    assert response.headers["cache-control"] == "no-store"


def test_authenticated_profile_is_not_cached(client, payload, mail):
    headers = verified_login(client, payload, mail)
    assert client.get("/api/perfil", headers=headers).headers["cache-control"] == "no-store"


def test_editing_detail_is_private_owner_scoped_and_not_cached(client, payload, mail, db):
    headers = verified_login(client, payload, mail)
    db.publications[8] = 2
    assert client.get("/api/publicaciones/8", headers=headers).status_code == 404
    db.publications[8] = 1
    response = client.get("/api/publicaciones/8", headers=headers)
    assert response.status_code == 200
    assert response.json()["titulo"] == "Título"
    assert response.headers["cache-control"] == "no-store"


def test_valid_signed_token_without_registered_session_is_rejected(client):
    token, _ = security.create_access_token(1)
    assert client.get("/api/perfil", headers={"Authorization": "Bearer " + token}).status_code == 401


def test_duplicate_normalized_accounts_are_not_selected_arbitrarily(client, payload, db):
    db.users[1] = {**payload, "verificado": False}
    db.users[2] = {**payload, "correo": payload["correo"].upper(), "verificado": False}
    assert register(client, payload).status_code == 409
    assert not db.codes and not db.sessions


def test_connection_create_and_accept_keep_json_contract(client, payload, mail):
    from backend.match_conexion_service.database import get_db
    from backend.match_conexion_service.models import EstadoConexion, Conexion
    headers = verified_login(client, payload, mail)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    def refresh(created):
        created.id_conexion = 9
        created.fecha_solicitud = datetime.now(timezone.utc)
        if created.estado is None:
            created.estado = EstadoConexion.Pendiente
    db.refresh.side_effect = refresh
    web.app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.post("/conexiones/", headers=headers, json={"id_solicitante_FK": 1, "id_receptor_FK": 2})
        assert response.status_code == 201
        assert response.json()["id_solicitante_FK"] == 1
        assert response.json()["estado"] == "Pendiente"
        received = Conexion(id_conexion=9, id_solicitante_FK=2, id_receptor_FK=1, estado=EstadoConexion.Pendiente)
        db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = received
        response = client.put("/conexiones/9", headers=headers, json={"estado": "Aceptada"})
        assert response.status_code == 200
        assert response.json()["estado"] == "Aceptada"
        assert response.json()["id_receptor_FK"] == 1
    finally:
        web.app.dependency_overrides.clear()
