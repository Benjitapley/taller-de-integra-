"""Panel de consulta. No concede permisos de modificación de datos."""
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg import Error

from backend.auth_service import database
from backend.auth_service.security import get_current_user, valid_user_id

router = APIRouter(prefix="/api/admin", tags=["Administración"])


def require_admin(user_id: int = Depends(get_current_user)) -> int:
    # Solo configuración del operador. Nunca correo, perfil, headers o claims de rol.
    configured = os.getenv("ADMIN_USER_IDS", "").strip()
    ids = [value.strip() for value in configured.split(",")]
    if not configured:
        raise HTTPException(403, "Acceso administrativo no permitido.")
    if any(not valid_user_id(value) for value in ids):
        raise HTTPException(503, "Administración no disponible.")
    if str(user_id) not in ids:
        raise HTTPException(403, "Acceso administrativo no permitido.")
    return user_id


@router.get("/resumen")
def resumen(_admin: int = Depends(require_admin)):
    try:
        with database.conectar() as conn:
            row = conn.execute('''
                SELECT (SELECT count(*) FROM haycupo.usuario),
                       (SELECT count(*) FROM haycupo.publicacion),
                       (SELECT count(*) FROM haycupo.conexion)
            ''').fetchone()
        return dict(zip(("usuarios", "publicaciones", "conexiones"), row))
    except Error:
        raise HTTPException(503, "No se pudo consultar el resumen administrativo.") from None


@router.get("/publicaciones")
def publicaciones(
    limite: int = Query(20, ge=1, le=100),
    pagina: int = Query(1, ge=1, le=100000),
    _admin: int = Depends(require_admin),
):
    try:
        with database.conectar() as conn:
            rows = conn.execute('''
                SELECT id_publicacion, titulo, precio, ubicacion, estado, cupos_totales
                FROM haycupo.publicacion
                ORDER BY id_publicacion DESC LIMIT %s OFFSET %s
            ''', (limite + 1, (pagina - 1) * limite)).fetchall()
        return {"items": [dict(zip(("id", "titulo", "precio", "ubicacion", "estado", "cupos_totales"), row)) for row in rows[:limite]],
                "pagina": pagina, "hay_mas": len(rows) > limite}
    except Error:
        raise HTTPException(503, "No se pudieron consultar las publicaciones.") from None
