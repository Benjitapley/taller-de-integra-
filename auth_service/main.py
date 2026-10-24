"""
Auth Service - Roomies
Endpoints de autenticación: registro, verificación por correo, login y logout.
Seguridad: Argon2 (contraseñas) + JWT (sesiones) + Fernet (datos sensibles).
"""

import logging
import os
from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, status
from dotenv import load_dotenv

import psycopg

from auth_service.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from auth_service.email_service import (
    generar_codigo,
    calcular_expiracion,
    enviar_codigo_verificacion,
)
from auth_service.models import (
    RegistroRequest,
    LoginRequest,
    VerificacionRequest,
    ReenviarCodigoRequest,
)

load_dotenv()
logger = logging.getLogger(__name__)

auth_router = APIRouter()

EDAD_MINIMA = 18

# Misma conexión directa a tu base de datos
DB_URL = os.getenv("DATABASE_URL")


def conectar():
    if not DB_URL:
        raise RuntimeError("DATABASE_URL no está configurada en el archivo .env")
    return psycopg.connect(DB_URL, connect_timeout=10)


def calcular_edad(fecha_nacimiento: date) -> int:
    hoy = date.today()
    edad = hoy.year - fecha_nacimiento.year
    if (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
        edad -= 1
    return edad


# ==========================================
# 1. REGISTRO (con hash Argon2 + código de verificación)
# ==========================================
@auth_router.post("/auth/registro")
def registrar_usuario(datos: RegistroRequest):
    edad = calcular_edad(datos.fecha_nacimiento)
    if edad < EDAD_MINIMA:
        raise HTTPException(
            status_code=400,
            detail=f"Debes tener al menos {EDAD_MINIMA} años para registrarte.",
        )

    if len(datos.contrasena) < 6:
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe tener al menos 6 caracteres.",
        )

    # Hashear la contraseña con Argon2 ANTES de guardarla
    contrasena_hash = hash_password(datos.contrasena)

    try:
        with conectar() as conexion:
            # 1. Verificar si el correo ya existe
            existe = conexion.execute(
                "SELECT id_usuario, verificado FROM haycupo.usuario WHERE correo = %s",
                (datos.correo,)
            ).fetchone()

            if existe:
                # Si existe pero NO está verificado, permitir reenviar código
                if not existe[1]:
                    codigo = generar_codigo()
                    expira = calcular_expiracion()

                    # Invalidar códigos anteriores
                    conexion.execute(
                        "UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id_usuario = %s AND usado = FALSE",
                        (existe[0],)
                    )

                    # Crear nuevo código
                    conexion.execute(
                        "INSERT INTO haycupo.codigo_verificacion (id_usuario, codigo, expira_en) VALUES (%s, %s, %s)",
                        (existe[0], codigo, expira)
                    )

                    # Actualizar contraseña por si la cambió
                    conexion.execute(
                        "UPDATE haycupo.usuario SET contrasena = %s WHERE id_usuario = %s",
                        (contrasena_hash, existe[0])
                    )

                    # Enviar correo
                    enviado = enviar_codigo_verificacion(datos.correo, datos.nombre, codigo)
                    if not enviado:
                        logger.warning(f"No se pudo enviar el correo a {datos.correo}")

                    return {
                        "success": True,
                        "message": "Se reenvió el código de verificación a tu correo.",
                        "verificacion_pendiente": True,
                    }

                raise HTTPException(status_code=409, detail="Ya existe una cuenta verificada con ese correo.")

            # 2. Crear usuario con contraseña hasheada y verificado=false
            nuevo_id = conexion.execute(
                """
                INSERT INTO haycupo.usuario (nombre, correo, contrasena, fecha_nacimiento, verificado) 
                VALUES (%s, %s, %s, %s, FALSE) RETURNING id_usuario
                """,
                (datos.nombre, datos.correo, contrasena_hash, datos.fecha_nacimiento.isoformat())
            ).fetchone()[0]

            # 3. Generar y guardar código de verificación
            codigo = generar_codigo()
            expira = calcular_expiracion()

            conexion.execute(
                "INSERT INTO haycupo.codigo_verificacion (id_usuario, codigo, expira_en) VALUES (%s, %s, %s)",
                (nuevo_id, codigo, expira)
            )

            # 4. Enviar correo con el código
            enviado = enviar_codigo_verificacion(datos.correo, datos.nombre, codigo)
            if not enviado:
                logger.warning(f"No se pudo enviar el correo de verificación a {datos.correo}")

            return {
                "success": True,
                "message": "Cuenta creada. Revisa tu correo para el código de verificación.",
                "verificacion_pendiente": True,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al registrar: {e}")
        raise HTTPException(status_code=500, detail=f"Error al registrar: {str(e)}")


# ==========================================
# 2. VERIFICAR CUENTA (con código enviado al correo)
# ==========================================
@auth_router.post("/auth/verificar")
def verificar_cuenta(datos: VerificacionRequest):
    try:
        with conectar() as conexion:
            # Buscar el usuario por correo
            usuario = conexion.execute(
                "SELECT id_usuario, verificado FROM haycupo.usuario WHERE correo = %s",
                (datos.correo,)
            ).fetchone()

            if not usuario:
                raise HTTPException(status_code=404, detail="No existe una cuenta con ese correo.")

            if usuario[1]:
                return {"success": True, "message": "La cuenta ya está verificada. Puedes iniciar sesión."}

            id_usuario = usuario[0]

            # Buscar código válido (no usado y no expirado)
            codigo_db = conexion.execute(
                """
                SELECT id, codigo, expira_en 
                FROM haycupo.codigo_verificacion 
                WHERE id_usuario = %s AND usado = FALSE 
                ORDER BY creado_en DESC 
                LIMIT 1
                """,
                (id_usuario,)
            ).fetchone()

            if not codigo_db:
                raise HTTPException(
                    status_code=400,
                    detail="No hay código de verificación pendiente. Solicita uno nuevo.",
                )

            # Verificar expiración
            expira_en = codigo_db[2]
            if isinstance(expira_en, datetime) and expira_en.tzinfo is None:
                expira_en = expira_en.replace(tzinfo=timezone.utc)

            if datetime.now(timezone.utc) > expira_en:
                # Marcar como usado (expirado)
                conexion.execute(
                    "UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id = %s",
                    (codigo_db[0],)
                )
                raise HTTPException(
                    status_code=400,
                    detail="El código ha expirado. Solicita uno nuevo.",
                )

            # Verificar código
            if codigo_db[1] != datos.codigo:
                raise HTTPException(status_code=400, detail="Código de verificación incorrecto.")

            # Marcar código como usado y usuario como verificado
            conexion.execute(
                "UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id = %s",
                (codigo_db[0],)
            )
            conexion.execute(
                "UPDATE haycupo.usuario SET verificado = TRUE WHERE id_usuario = %s",
                (id_usuario,)
            )

            return {
                "success": True,
                "message": "¡Cuenta verificada exitosamente! Ya puedes iniciar sesión.",
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al verificar cuenta: {e}")
        raise HTTPException(status_code=500, detail="Error al verificar la cuenta.")


# ==========================================
# 3. REENVIAR CÓDIGO DE VERIFICACIÓN
# ==========================================
@auth_router.post("/auth/reenviar-codigo")
def reenviar_codigo(datos: ReenviarCodigoRequest):
    try:
        with conectar() as conexion:
            usuario = conexion.execute(
                "SELECT id_usuario, nombre, verificado FROM haycupo.usuario WHERE correo = %s",
                (datos.correo,)
            ).fetchone()

            if not usuario:
                raise HTTPException(status_code=404, detail="No existe una cuenta con ese correo.")

            if usuario[2]:
                return {"success": True, "message": "La cuenta ya está verificada."}

            id_usuario = usuario[0]
            nombre = usuario[1]

            # Invalidar códigos anteriores
            conexion.execute(
                "UPDATE haycupo.codigo_verificacion SET usado = TRUE WHERE id_usuario = %s AND usado = FALSE",
                (id_usuario,)
            )

            # Generar nuevo código
            codigo = generar_codigo()
            expira = calcular_expiracion()

            conexion.execute(
                "INSERT INTO haycupo.codigo_verificacion (id_usuario, codigo, expira_en) VALUES (%s, %s, %s)",
                (id_usuario, codigo, expira)
            )

            # Enviar correo
            enviado = enviar_codigo_verificacion(datos.correo, nombre, codigo)
            if not enviado:
                raise HTTPException(
                    status_code=503,
                    detail="No se pudo enviar el correo. Verifica la configuración SMTP.",
                )

            return {
                "success": True,
                "message": "Nuevo código enviado a tu correo.",
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al reenviar código: {e}")
        raise HTTPException(status_code=500, detail="Error al reenviar el código.")


# ==========================================
# 4. LOGIN (Argon2 verify + JWT)
# ==========================================
@auth_router.post("/auth/login")
def iniciar_sesion(datos: LoginRequest):
    try:
        with conectar() as conexion:
            # Buscar usuario por correo (traer hash de contraseña)
            usuario = conexion.execute(
                "SELECT id_usuario, nombre, contrasena, verificado FROM haycupo.usuario WHERE correo = %s",
                (datos.correo,)
            ).fetchone()

            if not usuario:
                raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

            id_usuario, nombre, contrasena_hash, verificado = usuario

            # Verificar contraseña con Argon2
            if not verify_password(datos.contrasena, contrasena_hash):
                raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

            # Verificar que la cuenta esté verificada
            if not verificado:
                raise HTTPException(
                    status_code=403,
                    detail="Tu cuenta aún no está verificada. Revisa tu correo o solicita un nuevo código.",
                )

            # Generar token JWT
            access_token = create_access_token(
                data={
                    "sub": str(id_usuario),
                    "nombre": nombre,
                    "correo": datos.correo,
                }
            )

            return {
                "success": True,
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": id_usuario,
                    "nombre": nombre,
                    "correo": datos.correo,
                },
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en login: {e}")
        raise HTTPException(status_code=500, detail="Error en la base de datos al iniciar sesión.")


# ==========================================
# 5. LOGOUT
# ==========================================
@auth_router.post("/auth/logout")
def cerrar_sesion():
    # Con JWT, el logout se maneja del lado del cliente
    # eliminando el token del almacenamiento local.
    # Aquí solo confirmamos la acción.
    return {"success": True, "message": "Sesión cerrada. Elimina el token del almacenamiento local."}