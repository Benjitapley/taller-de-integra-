from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import Conexion, EstadoConexion
from schemas import ConexionCreate, ConexionResponse, ConexionUpdate
# Nota: Asumimos que tienes un archivo database.py que te da la sesion, típico en FastAPI.
# Si tu compañero de auth-service configuró la DB de otra forma, después ajustamos el import 'get_db'
from database import get_db 
from fastapi import Query
from typing import List, Optional
from models import Usuario, Publicacion
from schemas import UsuarioBusqueda, PublicacionBusqueda

router = APIRouter(
    prefix="/conexiones",
    tags=["Conexiones"]
)

# 1. ENVIAR solicitud de conexión
@router.post("/", response_model=ConexionResponse, status_code=status.HTTP_201_CREATED)
def enviar_solicitud(conexion: ConexionCreate, db: Session = Depends(get_db)):
    # Verificamos si ya existe una conexión pendiente entre ellos para no duplicar
    conexion_existente = db.query(Conexion).filter(
        Conexion.id_solicitante_FK == conexion.id_solicitante_FK,
        Conexion.id_receptor_FK == conexion.id_receptor_FK,
        Conexion.estado == EstadoConexion.Pendiente
    ).first()

    if conexion_existente:
        raise HTTPException(status_code=400, detail="Ya existe una solicitud pendiente entre estos usuarios.")

    nueva_conexion = Conexion(
        id_solicitante_FK=conexion.id_solicitante_FK,
        id_receptor_FK=conexion.id_receptor_FK
    )
    db.add(nueva_conexion)
    db.commit()
    db.refresh(nueva_conexion)
    return nueva_conexion


# 2. ACEPTAR o RECHAZAR solicitud de conexión
@router.put("/{id_conexion}", response_model=ConexionResponse)
def responder_solicitud(id_conexion: int, respuesta: ConexionUpdate, db: Session = Depends(get_db)):
    conexion_db = db.query(Conexion).filter(Conexion.id_conexion == id_conexion).first()

    if not conexion_db:
        raise HTTPException(status_code=404, detail="Solicitud de conexión no encontrada.")

    if conexion_db.estado != EstadoConexion.Pendiente:
        raise HTTPException(status_code=400, detail=f"Esta solicitud ya fue {conexion_db.estado.value}.")

    # Actualizamos el estado con lo que envíe el usuario (Aceptada o Rechazada)
    conexion_db.estado = respuesta.estado
    db.commit()
    db.refresh(conexion_db)
    return conexion_db


# Endpoint extra (opcional pero útil para tu frontend): Ver las solicitudes que me han llegado
@router.get("/recibidas/{id_usuario}", response_model=list[ConexionResponse])
def ver_solicitudes_recibidas(id_usuario: int, db: Session = Depends(get_db)):
    solicitudes = db.query(Conexion).filter(
        Conexion.id_receptor_FK == id_usuario,
        Conexion.estado == EstadoConexion.Pendiente
    ).all()
    return solicitudes  

# --- ENDPOINT BÚSQUEDA DE USUARIOS (ROOMIES) ---
@router.get("/usuarios/buscar", response_model=List[UsuarioBusqueda])
def buscar_usuarios(
    presupuesto_max: Optional[int] = Query(None, description="Presupuesto máximo del roomie"),
    zona: Optional[str] = Query(None, description="Zona de interés (ej: Centro, Norte)"),
    ocupacion: Optional[str] = Query(None, description="Estudiante, Trabajador o Ambos"),
    db: Session = Depends(get_db)
):
    consulta = db.query(Usuario)
    
    # Aplicamos los filtros dinámicamente si el usuario los envía
    if presupuesto_max:
        consulta = consulta.filter(Usuario.presupuesto <= presupuesto_max)
    if zona:
        consulta = consulta.filter(Usuario.zona_interes.ilike(f"%{zona}%"))
    if ocupacion:
        consulta = consulta.filter(Usuario.ocupacion == ocupacion)
        
    return consulta.all()

# --- ENDPOINT BÚSQUEDA DE PUBLICACIONES (ARRIENDOS) ---
@router.get("/publicaciones/buscar", response_model=List[PublicacionBusqueda])
def buscar_publicaciones(
    precio_max: Optional[float] = Query(None, description="Precio máximo del arriendo"),
    ubicacion: Optional[str] = Query(None, description="Ubicación o ciudad"),
    tipo: Optional[str] = Query(None, description="Arrendador o Compartida"),
    db: Session = Depends(get_db)
):
    # Solo buscamos publicaciones que estén "Activas"[cite: 7]
    consulta = db.query(Publicacion).filter(Publicacion.estado == "Activa")
    
    if precio_max:
        consulta = consulta.filter(Publicacion.precio <= precio_max)
    if ubicacion:
        consulta = consulta.filter(Publicacion.ubicacion.ilike(f"%{ubicacion}%"))
    if tipo:
        consulta = consulta.filter(Publicacion.tipo == tipo)
        
    return consulta.all()