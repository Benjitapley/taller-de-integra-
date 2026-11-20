"""Adaptación de 21e9ffa: misma API JSON, activación explícita y SQL parametrizado.

Requiere el esquema ampliado descrito en ADAPTATION.md. No crea/migra tablas.
"""
import hmac
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from backend.auth_service import database
from backend.auth_service.security import (
    auth_enabled, create_access_token, get_identity, hash_password, verify_password, Identity,
)
from backend.auth_service.email_service import generar_codigo, huella_codigo, enviar_codigo_verificacion
from backend.auth_service.models import (
    RegistroRequest, LoginRequest, VerificacionRequest, ReenviarCodigoRequest,
    RegistroResponse, MessageResponse, TokenResponse,
)

auth_router = APIRouter(dependencies=[Depends(auth_enabled)], tags=["Autenticación"])


@contextmanager
def transaccion():
    try:
        with database.conectar() as conn:
            yield conn
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Servicio de autenticación no disponible.") from None


def ahora():
    return datetime.now(timezone.utc)


def calcular_edad(fecha_nacimiento: date) -> int:
    hoy = date.today()
    return hoy.year - fecha_nacimiento.year - ((hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day))


def buscar_usuario(conn, correo):
    # Serializa también altas simultáneas del mismo correo en este servicio.
    # Un índice UNIQUE normalizado sigue siendo una dependencia de despliegue.
    conn.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (correo,))
    rows = conn.execute("""
        SELECT id_usuario, nombre, correo, verificado FROM haycupo.usuario
        WHERE lower(btrim(correo)) = %s FOR UPDATE
    """, (correo,)).fetchall()
    if len(rows) > 1:
        raise HTTPException(409, "La cuenta requiere revisión antes de continuar.")
    return rows[0] if rows else None


def preparar_codigo(conn, usuario):
    settings = auth_enabled()
    user_id, nombre, correo, _ = usuario
    now = ahora()
    history = conn.execute("""
        SELECT creado_en FROM haycupo.codigo_verificacion
        WHERE id_usuario = %s AND creado_en >= %s ORDER BY creado_en DESC
    """, (user_id, now - timedelta(hours=1))).fetchall()
    if history and (now - history[0][0]).total_seconds() < settings.resend_seconds:
        raise HTTPException(429, "Espera antes de solicitar otro código.", headers={"Retry-After": str(settings.resend_seconds)})
    if len(history) >= settings.sends_per_hour:
        raise HTTPException(429, "Límite de códigos alcanzado. Intenta más tarde.", headers={"Retry-After": "3600"})
    codigo = generar_codigo()
    conn.execute("UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id_usuario = %s AND usado = FALSE", (user_id,))
    code_id = conn.execute("""
        INSERT INTO haycupo.codigo_verificacion
            (id_usuario, codigo_hash, expira_en, creado_en, intentos, usado)
        VALUES (%s, %s, %s, %s, 0, FALSE) RETURNING id
    """, (user_id, huella_codigo(user_id, codigo), now + timedelta(minutes=settings.code_minutes), now)).fetchone()[0]
    return code_id, correo, nombre, codigo


def entregar_codigo(preparado):
    # El código se confirma en BD ANTES del SMTP; no se mantiene una transacción
    # abierta durante la red. Hasta enviado_en, no puede verificarse.
    code_id, correo, nombre, codigo = preparado
    try:
        enviado = enviar_codigo_verificacion(correo, nombre, codigo)
    except Exception:
        enviado = False
    with transaccion() as conn:
        if enviado:
            delivered = conn.execute("""
                UPDATE haycupo.codigo_verificacion SET enviado_en = %s
                WHERE id = %s AND usado = FALSE RETURNING id
            """, (ahora(), code_id)).fetchone()
        else:
            conn.execute("UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id = %s", (code_id,))
    if not enviado:
        raise HTTPException(503, "No se pudo enviar el correo. La cuenta sigue pendiente; solicita otro código más tarde.")
    if not delivered:
        raise HTTPException(409, "El código fue reemplazado. Solicita uno nuevo.")


@auth_router.post("/auth/registro", response_model=RegistroResponse)
def registrar_usuario(datos: RegistroRequest):
    if calcular_edad(datos.fecha_nacimiento) < 18:
        raise HTTPException(400, "Debes tener al menos 18 años para registrarte.")
    if len(datos.contrasena) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres.")
    with transaccion() as conn:
        usuario = buscar_usuario(conn, datos.correo)
        if usuario and usuario[3]:
            raise HTTPException(409, "Ya existe una cuenta verificada con ese correo.")
        if usuario is None:
            user_id = conn.execute("""
                INSERT INTO haycupo.usuario (nombre, correo, contrasena, fecha_nacimiento, verificado)
                VALUES (%s, %s, %s, %s, FALSE) RETURNING id_usuario
            """, (datos.nombre, datos.correo, hash_password(datos.contrasena), datos.fecha_nacimiento)).fetchone()[0]
            usuario = (user_id, datos.nombre, datos.correo, False)
        # Cuenta existente: no cambiar nombre, correo, fecha ni contraseña.
        preparado = preparar_codigo(conn, usuario)
    entregar_codigo(preparado)
    return RegistroResponse(message="Revisa tu correo para verificar tu cuenta.")


@auth_router.post("/auth/reenviar-codigo", response_model=MessageResponse)
def reenviar_codigo(datos: ReenviarCodigoRequest):
    with transaccion() as conn:
        usuario = buscar_usuario(conn, datos.correo)
        if usuario is None:
            raise HTTPException(404, "No existe una cuenta con ese correo.")
        if usuario[3]:
            return MessageResponse(message="La cuenta ya está verificada.")
        preparado = preparar_codigo(conn, usuario)
    entregar_codigo(preparado)
    return MessageResponse(message="Nuevo código enviado a tu correo.")


@auth_router.post("/auth/verificar", response_model=MessageResponse)
def verificar_cuenta(datos: VerificacionRequest):
    error = None
    settings = auth_enabled()
    with transaccion() as conn:
        usuario = buscar_usuario(conn, datos.correo)
        if usuario is None:
            raise HTTPException(404, "No existe una cuenta con ese correo.")
        if usuario[3]:
            return MessageResponse(message="La cuenta ya está verificada. Puedes iniciar sesión.")
        user_id = usuario[0]
        code = conn.execute("""
            SELECT id, codigo_hash, expira_en, intentos FROM haycupo.codigo_verificacion
            WHERE id_usuario = %s AND usado = FALSE AND enviado_en IS NOT NULL
            ORDER BY creado_en DESC, id DESC LIMIT 1 FOR UPDATE
        """, (user_id,)).fetchone()
        if not code:
            raise HTTPException(400, "No hay código pendiente. Solicita uno nuevo.")
        code_id, digest, expires, attempts = code
        if expires <= ahora():
            conn.execute("UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id = %s", (code_id,))
            error = HTTPException(400, "El código ha expirado. Solicita uno nuevo.")
        elif attempts >= settings.max_attempts:
            conn.execute("UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id = %s", (code_id,))
            error = HTTPException(429, "Código bloqueado. Solicita uno nuevo.")
        elif not hmac.compare_digest(huella_codigo(user_id, datos.codigo), digest):
            attempts += 1
            conn.execute("UPDATE haycupo.codigo_verificacion SET intentos = %s, usado = %s WHERE id = %s",
                         (attempts, attempts >= settings.max_attempts, code_id))
            error = HTTPException(429 if attempts >= settings.max_attempts else 400, "Código incorrecto o bloqueado.")
        else:
            conn.execute("UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id = %s", (code_id,))
            conn.execute("UPDATE haycupo.usuario SET verificado = TRUE WHERE id_usuario = %s", (user_id,))
    # Lanzar DESPUÉS del commit conserva intentos, consumo y expiración.
    if error:
        raise error
    return MessageResponse(message="Cuenta verificada. Ya puedes iniciar sesión.")


@auth_router.post("/auth/login", response_model=TokenResponse)
def iniciar_sesion(datos: LoginRequest):
    with transaccion() as conn:
        usuario = buscar_usuario(conn, datos.correo)
        if usuario is None:
            # Coste Argon2 también para correo inexistente; sin hash fijo secreto.
            hash_password(datos.contrasena)
            raise HTTPException(401, "Correo o contraseña incorrectos.")
        user_id, nombre, correo, verificado = usuario
        stored = conn.execute("SELECT contrasena FROM haycupo.usuario WHERE id_usuario = %s", (user_id,)).fetchone()
        if not stored or not verify_password(datos.contrasena, stored[0]):
            raise HTTPException(401, "Correo o contraseña incorrectos.")
        if not verificado:
            raise HTTPException(403, "Tu cuenta aún no está verificada.")
        token, claims = create_access_token(user_id)
        conn.execute("""
            INSERT INTO haycupo.sesion_jwt (jti, id_usuario, expira_en, revocado)
            VALUES (%s, %s, %s, FALSE)
        """, (claims["jti"], user_id, datetime.fromtimestamp(claims["exp"], timezone.utc)))
    return TokenResponse(access_token=token, user={"id": user_id, "nombre": nombre, "correo": correo})


@auth_router.post("/auth/logout", response_model=MessageResponse)
def cerrar_sesion(identity: Identity = Depends(get_identity)):
    with transaccion() as conn:
        conn.execute("UPDATE haycupo.sesion_jwt SET revocado = TRUE WHERE jti = %s AND id_usuario = %s",
                     (identity.jti, identity.user_id))
    return MessageResponse(message="Sesión revocada.")
