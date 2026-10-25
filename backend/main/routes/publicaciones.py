from decimal import Decimal
from io import BytesIO
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from PIL import Image

from backend.auth_service.security import get_current_user

router = APIRouter()

# OBTENER TODAS LAS PUBLICACIONES (Para el inicio)
@router.get("/api/publicaciones")
def obtener_publicaciones(request: Request):
    try:
        with request.app.state.conectar() as conexion:
            registros = conexion.execute("""
                SELECT p.id_publicacion, p.titulo, p.precio, p.ubicacion, p.cupos_totales,
                       p.tipo_vivienda, i.url as imagen_url, p.categoria, p.descripcion, p.mascota, p.contenido
                FROM haycupo.publicacion p
                LEFT JOIN haycupo.imagen_publicacion i ON p.id_publicacion = i.id_publicacion
                ORDER BY p.id_publicacion DESC
            """).fetchall()

            publicaciones = []
            for row in registros:
                desc_final = row[10] if row[10] else row[8]
                publicaciones.append({
                    "id": row[0], "titulo": row[1], "precio": float(row[2]), "ubicacion": row[3],
                    "cupos_totales": row[4], "tipo_vivienda": row[5], "imagen": row[6],
                    "categoria": row[7], "descripcion": desc_final, "mascota": row[9]
                })
            return publicaciones
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar publicaciones")


# OBTENER SOLO MIS PUBLICACIONES (Para el CRUD)
@router.get("/api/mis-publicaciones")
def obtener_mis_publicaciones(request: Request, id_usuario: int = Depends(get_current_user)):
    try:
        with request.app.state.conectar() as conexion:
            registros = conexion.execute("""
                SELECT p.id_publicacion, p.titulo, p.precio, p.estado, p.tipo_vivienda, p.ubicacion, p.cupos_totales, i.url
                FROM haycupo.publicacion p
                LEFT JOIN haycupo.imagen_publicacion i ON p.id_publicacion = i.id_publicacion
                WHERE p.id_usuario = %s
                ORDER BY p.id_publicacion DESC
            """, (id_usuario,)).fetchall()

            return [{"id": r[0], "titulo": r[1], "precio": float(r[2]), "estado": r[3], "tipo": r[4], "ubicacion": r[5], "cupos": r[6], "imagen": r[7]} for r in registros]
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar tus publicaciones")


# OBTENER UNA SOLA PUBLICACIÓN (Para rellenar el formulario al editar)
@router.get("/api/publicaciones/{id_pub}")
def obtener_una_publicacion(request: Request, id_pub: int, id_usuario: int = Depends(get_current_user)):
    with request.app.state.conectar() as conexion:
        r = conexion.execute("""
            SELECT titulo, categoria, tipo_vivienda, ubicacion, precio, cupos_totales, mascota, descripcion
            FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s
        """, (id_pub, id_usuario)).fetchone()

        if r:
            return {
                "titulo": r[0], "categoria": r[1], "tipo_vivienda": r[2],
                "ubicacion": r[3], "precio": r[4], "cupos_totales": r[5],
                "mascota": r[6], "descripcion": r[7]
            }
        raise HTTPException(status_code=404, detail="Publicación no encontrada")


# CREAR PUBLICACIÓN NUEVA
@router.post("/api/publicaciones", status_code=201)
def crear_publicacion(request: Request,
    titulo: Annotated[str, Form(min_length=1, max_length=200)],
    categoria: Annotated[Literal["busco", "ofrezco"], Form()],
    ubicacion: Annotated[str, Form(min_length=1, max_length=250)],
    precio: Annotated[Decimal, Form(ge=0, max_digits=14, decimal_places=2)],
    tipo: Annotated[Literal["Arrendador", "Compartida"], Form()],
    cupos_totales: Annotated[int, Form(ge=1, le=2147483647)],
    tipo_vivienda: Annotated[Literal["casa", "departamento", "habitacion"], Form()],
    descripcion: Annotated[str, Form(min_length=1, max_length=5000)],
    mascota: Annotated[str, Form()] = "no",
    permitir_comentarios: Annotated[str, Form()] = "false",
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(get_current_user)
):
    texto_desc = descripcion.strip()
    permitir = True if permitir_comentarios.lower() == "true" else False

    if not all([titulo.strip(), ubicacion.strip(), texto_desc]):
        raise HTTPException(status_code=422, detail="Completa el título, ubicación y descripción.")

    nombre_imagen = None
    ruta_imagen = None

    if imagen and imagen.filename:
        limite = 5 * 1024 * 1024
        contenido_img = imagen.file.read(limite + 1)
        if len(contenido_img) > limite:
            raise HTTPException(status_code=413, detail="La imagen debe pesar como máximo 5 MB.")
        try:
            with Image.open(BytesIO(contenido_img)) as foto:
                extensiones = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
                extension = extensiones.get(foto.format)
                if not extension:
                    raise HTTPException(status_code=422, detail="Usa una imagen JPG, PNG o WEBP.")
                foto.verify()
        except Exception:
            raise HTTPException(status_code=422, detail="El archivo no es válido.") from None

        nombre_imagen = uuid4().hex + extension
        ruta_imagen = request.app.state.obtener_imagenes() / nombre_imagen

    try:
        with request.app.state.conectar() as conexion:
            fila = conexion.execute(
                """
                INSERT INTO haycupo.publicacion (
                    id_usuario, tipo, titulo, descripcion, precio, ubicacion,
                    estado, cupos_totales, categoria, tipo_vivienda,
                    permitir_comentarios, mascota, contenido
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'Disponible', %s, %s, %s, %s, %s, %s)
                RETURNING id_publicacion
                """,
                (id_usuario, tipo, titulo, texto_desc, precio, ubicacion,
                 cupos_totales, categoria, tipo_vivienda, permitir, mascota, texto_desc),
            ).fetchone()

            identificador = fila[0]

            if ruta_imagen:
                ruta_imagen.write_bytes(contenido_img)
                conexion.execute(
                    "INSERT INTO haycupo.imagen_publicacion (id_publicacion, url, orden) VALUES (%s, %s, 0)",
                    (identificador, f"/imagenes/{nombre_imagen}")
                )
    except Exception:
        if ruta_imagen:
            ruta_imagen.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Error al guardar.") from None

    return {"id": identificador, "mensaje": "Publicación creada"}


# ACTUALIZAR UNA PUBLICACIÓN EXISTENTE
@router.put("/api/publicaciones/{id_pub}")
def actualizar_publicacion(request: Request,
    id_pub: int,
    titulo: Annotated[str, Form()],
    categoria: Annotated[str, Form()],
    ubicacion: Annotated[str, Form()],
    precio: Annotated[Decimal, Form()],
    tipo_vivienda: Annotated[str, Form()],
    descripcion: Annotated[str, Form()],
    tipo: Annotated[str, Form()],
    cupos_totales: Annotated[int, Form()],
    mascota: Annotated[str, Form()] = "no",
    permitir_comentarios: Annotated[str, Form()] = "false",
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(get_current_user)
):
    try:
        with request.app.state.conectar() as conexion:
            updated = conexion.execute("""
                UPDATE haycupo.publicacion
                SET titulo=%s, categoria=%s, ubicacion=%s, precio=%s,
                    tipo_vivienda=%s, descripcion=%s, cupos_totales=%s, mascota=%s, contenido=%s
                WHERE id_publicacion=%s AND id_usuario=%s
            """, (titulo, categoria, ubicacion, precio, tipo_vivienda, descripcion, cupos_totales, mascota, descripcion, id_pub, id_usuario))
            if updated.rowcount == 0:
                raise HTTPException(404, "Publicación no encontrada o sin permiso.")
        return {"mensaje": "Publicación actualizada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="No se pudo actualizar la base de datos")


# ELIMINAR UNA PUBLICACIÓN
@router.delete("/api/publicaciones/{id_pub}")
def borrar_publicacion(request: Request, id_pub: int, id_usuario: int = Depends(get_current_user)):
    try:
        with request.app.state.conectar() as conexion:
            owner = conexion.execute("SELECT id_publicacion FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s FOR UPDATE", (id_pub, id_usuario)).fetchone()
            if owner is None:
                raise HTTPException(404, "Publicación no encontrada o sin permiso.")
            conexion.execute("DELETE FROM haycupo.imagen_publicacion WHERE id_publicacion = %s", (id_pub,))
            conexion.execute("DELETE FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s", (id_pub, id_usuario))
        return {"mensaje": "Publicación eliminada"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar")
