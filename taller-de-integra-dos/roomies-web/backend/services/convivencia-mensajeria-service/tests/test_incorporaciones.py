from concurrent.futures import ThreadPoolExecutor
import os
from uuid import uuid4

import psycopg
import pytest

pytestmark = pytest.mark.usefixtures("empty_database")


def payload(user=2, publication=7, application=9, version=1):
    return {"id_usuario": user, "id_publicacion": publication,
            "id_postulacion": application, "version_capacidad": version}


def count(table):
    assert table in {"arriendo", "pertenencia"}
    with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
        return connection.execute(f"SELECT count(*) FROM convivencia_mensajeria.{table}").fetchone()[0]


def test_reintento_reproduce_respuesta_tras_recrear_servicio(service, repository, ports):
    from app.service import Convivencia
    key = uuid4()
    original = service.incorporate(key, payload())
    assert original[0] == 201
    assert original[1]["estado"] == "Activa"
    retried = Convivencia(repository, *ports).incorporate(key, payload())
    assert retried[:2] == original[:2]
    assert retried[2] is True
    assert count("arriendo") == count("pertenencia") == 1


def test_misma_clave_otro_payload_no_crea_segunda_pertenencia(service):
    from app.models import ServiceError
    key = uuid4()
    assert service.incorporate(key, payload())[0] == 201
    with pytest.raises(ServiceError) as error:
        service.incorporate(key, payload(user=3))
    assert error.value.status == 409
    assert error.value.body["code"] == "IDEMPOTENCY_CONFLICT"
    assert count("pertenencia") == 1


def test_usuario_ya_activo_no_ingresa_a_otro_arriendo(service):
    assert service.incorporate(uuid4(), payload())[0] == 201
    status, body, _ = service.incorporate(uuid4(), payload(publication=8, application=10))
    assert status == 409
    assert body["code"] == "USER_ALREADY_ACTIVE"
    assert count("pertenencia") == 1


def test_una_publicacion_tiene_un_arriendo(service):
    first = service.incorporate(uuid4(), payload())
    second = service.incorporate(uuid4(), payload(user=3, application=10))
    assert first[0] == second[0] == 201
    assert first[1]["id_arriendo"] == second[1]["id_arriendo"]
    assert count("arriendo") == 1
    assert count("pertenencia") == 2


def test_ultimo_cupo_dos_solicitudes_concurrentes(repository, ports):
    from app.service import Convivencia
    ports[1].capacity = 1

    def admit(user):
        return Convivencia(type(repository)(), *ports).incorporate(uuid4(), payload(user=user, application=user + 10))

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(admit, [2, 3]))
    assert sorted(result[0] for result in results) == [201, 409]
    assert count("arriendo") == count("pertenencia") == 1


def test_usuario_concurrente_en_dos_publicaciones(repository, ports):
    from app.service import Convivencia

    def admit(publication):
        return Convivencia(type(repository)(), *ports).incorporate(uuid4(), payload(publication=publication, application=publication + 10))

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(admit, [7, 8]))
    assert sorted(result[0] for result in results) == [201, 409]
    assert count("pertenencia") == 1


def test_misma_clave_concurrente_solo_un_resultado(repository, ports):
    from app.service import Convivencia
    key = uuid4()

    def admit(_):
        return Convivencia(type(repository)(), *ports).incorporate(key, payload())

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(admit, [1, 2]))
    assert [r[0] for r in results] == [201, 201]
    assert results[0][1] == results[1][1]
    assert sum(bool(r[2]) for r in results) == 1
    assert count("pertenencia") == 1


def test_capacidad_versionada_no_se_sobrescribe(service):
    assert service.incorporate(uuid4(), payload())[0] == 201
    status, body, _ = service.incorporate(uuid4(), payload(user=3, application=10, version=2))
    assert status == 409
    assert body["code"] == "CAPACITY_VERSION_CONFLICT"
    assert count("pertenencia") == 1


def test_respuesta_reserva_perdida_reintenta_misma_clave(service, ports):
    from app.models import ServiceError
    key = uuid4()
    ports[1].lost_response = True
    with pytest.raises(ServiceError) as error:
        service.incorporate(key, payload())
    assert error.value.status == 503
    assert count("pertenencia") == 0
    assert service.incorporate(key, payload())[0] == 201
    assert len(ports[1].reservations) == 1
    assert ports[1].calls == [str(key), str(key)]


def test_outbox_confirma_y_reintenta_caida_sin_duplicar(service, ports):
    assert service.incorporate(uuid4(), payload())[0] == 201
    ports[1].confirm_down = True
    assert service.dispatch() == 0
    assert not ports[1].confirmed
    ports[1].confirm_down = False
    assert service.dispatch() == 1
    assert service.dispatch() == 0
    assert len(ports[1].confirmed) == 1
    assert count("pertenencia") == 1


def test_rechazo_local_libera_reserva_por_outbox_y_congela_error(service, ports):
    assert service.incorporate(uuid4(), payload())[0] == 201
    key = uuid4()
    first = service.incorporate(key, payload(publication=8, application=10))
    assert first[0] == 409
    assert first[1]["code"] == "USER_ALREADY_ACTIVE"
    assert len(ports[1].released) == 1
    assert service.dispatch() == 1
    assert len(ports[1].released) == 1
    assert service.incorporate(key, payload(publication=8, application=10))[:2] == first[:2]


def test_rechazo_no_es_final_hasta_liberar_reserva(service, ports):
    from app.models import ServiceError
    assert service.incorporate(uuid4(), payload())[0] == 201
    key = uuid4()
    ports[1].release_down = True
    for _ in range(2):
        with pytest.raises(ServiceError) as error:
            service.incorporate(key, payload(publication=8, application=10))
        assert error.value.status == 503
    assert not ports[1].released
    ports[1].release_down = False
    status, body, replay = service.incorporate(key, payload(publication=8, application=10))
    assert status == 409 and body["code"] == "USER_ALREADY_ACTIVE" and replay
    assert len(ports[1].released) == 1


def test_outbox_proyeccion_es_monotona_y_reintento_congela_body(service, ports):
    service.incorporate(uuid4(), payload())
    service.incorporate(uuid4(), payload(user=3, application=10))
    ports[1].confirm_down = True
    assert service.dispatch() == 0
    ports[1].confirm_down = False
    assert service.dispatch() == 2
    assert [item["ocupacion"] for item in ports[1].confirmations] == [1, 2]
    assert [item["version_ocupacion"] for item in ports[1].confirmations] == [1, 2]


def test_outbox_legado_solo_reconcilia_con_pertenencia_real(service, ports):
    from psycopg.types.json import Jsonb
    key = uuid4()
    service.incorporate(key, payload())
    with psycopg.connect(os.environ["CONVIVENCIA_TEST_ADMIN_DSN"]) as connection:
        connection.execute("UPDATE convivencia_mensajeria.outbox SET reserva=reserva-'confirmacion'")
    assert service.dispatch() == 1
    assert ports[1].confirmations == [{"id_arriendo": 1, "ocupacion": 1, "version_ocupacion": 1}]
    with psycopg.connect(os.environ["CONVIVENCIA_TEST_ADMIN_DSN"]) as connection:
        invalid = {**payload(user=99), "id_reserva": str(uuid4()), "cupos_totales": 2}
        connection.execute("UPDATE convivencia_mensajeria.outbox SET reserva=%s,enviado=false", (Jsonb(invalid),))
    assert service.dispatch() == 0
    assert len(ports[1].confirmations) == 1


def test_recuperacion_reanuda_operacion_pendiente_tras_respuesta_perdida(service, ports):
    from app.models import ServiceError
    key = uuid4()
    ports[1].lost_response = True
    with pytest.raises(ServiceError):
        service.incorporate(key, payload())
    assert service.recover() == 1
    assert count("pertenencia") == 1
    assert len(ports[1].reservations) == len(ports[1].confirmed) == 1


def test_reserva_perdida_se_libera_si_usuario_se_deshabilita(service, ports):
    from app.models import ServiceError
    key = uuid4()
    ports[1].lost_response = True
    with pytest.raises(ServiceError):
        service.incorporate(key, payload())
    ports[0].allowed = False
    assert service.recover() == 1
    assert count("pertenencia") == 0
    assert len(ports[1].reservations) == len(ports[1].released) == 1
    assert service.incorporate(key, payload())[0] == 403


def test_consultas_solo_miembro_activo(service, repository):
    from app.models import ServiceError
    _, body, _ = service.incorporate(uuid4(), payload())
    assert repository.mine(2)["id_arriendo"] == body["id_arriendo"]
    assert repository.get(body["id_arriendo"], 2)["ocupacion"] == 1
    for action in [lambda: repository.mine(3), lambda: repository.get(body["id_arriendo"], 3)]:
        with pytest.raises(ServiceError) as error:
            action()
        assert error.value.status == 404


def test_no_usa_identidad_deshabilitada(service, ports):
    ports[0].allowed = False
    status, _, _ = service.incorporate(uuid4(), payload())
    assert status == 403
    assert not ports[1].reservations
    assert count("pertenencia") == 0


def test_rol_no_puede_leer_otro_esquema():
    with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            connection.execute("SELECT * FROM forbidden_test.secret")


def test_indices_y_restricciones_reales(migrated_database):
    with psycopg.connect(migrated_database) as connection:
        definitions = [row[0] for row in connection.execute(
            "SELECT indexdef FROM pg_indexes WHERE schemaname='convivencia_mensajeria'").fetchall()]
    joined = "\n".join(definitions)
    assert "UNIQUE" in joined
    assert "id_publicacion" in joined
    assert "id_usuario" in joined and "WHERE" in joined


def test_trigger_impide_sobreocupacion_aunque_se_omita_servicio(service, repository, ports):
    ports[1].capacity = 1
    _, body, _ = service.incorporate(uuid4(), payload())
    other = uuid4()
    repository.begin(other, payload(user=3, application=10))
    with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
        with pytest.raises(psycopg.errors.CheckViolation):
            connection.execute("""INSERT INTO convivencia_mensajeria.pertenencia
                (id_arriendo,id_usuario,id_postulacion,id_operacion) VALUES(%s,3,10,%s)""", (body["id_arriendo"], other))
    assert count("pertenencia") == 1


def test_indice_parcial_impide_segunda_pertenencia_del_usuario(service, repository):
    _, body, _ = service.incorporate(uuid4(), payload())
    other = uuid4()
    repository.begin(other, payload(application=10))
    with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
        with pytest.raises(psycopg.errors.UniqueViolation):
            connection.execute("""INSERT INTO convivencia_mensajeria.pertenencia
                (id_arriendo,id_usuario,id_postulacion,id_operacion) VALUES(%s,2,10,%s)""", (body["id_arriendo"], other))


def test_runtime_no_puede_mutar_snapshot_ni_identidad_de_pertenencia(service):
    service.incorporate(uuid4(), payload())
    for statement in ["UPDATE convivencia_mensajeria.arriendo SET cupos_totales=99",
                      # Retiro grants only estado/terminada_en, never member identity.
                      "UPDATE convivencia_mensajeria.pertenencia SET id_usuario=99"]:
        with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                connection.execute(statement)


@pytest.mark.parametrize("state", ["Terminada", "Rechazada"])
def test_estado_final_exige_http_status_no_nulo(state):
    from psycopg.types.json import Jsonb
    with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
        with pytest.raises(psycopg.errors.CheckViolation):
            connection.execute("""INSERT INTO convivencia_mensajeria.incorporacion
                (id_operacion,payload,estado,http_status,respuesta) VALUES(%s,%s,%s,NULL,%s)""",
                               (uuid4(), Jsonb(payload()), state, Jsonb({})))
