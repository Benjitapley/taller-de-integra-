from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.match_conexion_service.database import get_db
from backend.match_conexion_service.models import Conexion, EstadoConexion, Usuario, Publicacion
from backend.match_conexion_service.schemas import ConexionCreate, ConexionResponse, ConexionUpdate, UsuarioBusqueda, PublicacionBusqueda
from backend.auth_service.security import get_current_user

router = APIRouter(
    prefix="/conexiones",
    tags=["Conexiones"],
)

# 1. ENVIAR solicitud de conexión
@router.post("/", response_model=ConexionResponse, status_code=status.HTTP_201_CREATED)
def enviar_solicitud(conexion: ConexionCreate, id_actual: int = Depends(get_current_user), db: Session = Depends(get_db)):
    if conexion.id_solicitante_FK != id_actual:
        raise HTTPException(403, "No puedes enviar solicitudes en nombre de otro usuario.")
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
def responder_solicitud(id_conexion: int, respuesta: ConexionUpdate, id_actual: int = Depends(get_current_user), db: Session = Depends(get_db)):
    conexion_db = db.query(Conexion).filter(Conexion.id_conexion == id_conexion).with_for_update().first()

    if not conexion_db:
        raise HTTPException(status_code=404, detail="Solicitud de conexión no encontrada.")

    if conexion_db.id_receptor_FK != id_actual:
        raise HTTPException(403, "Solo el destinatario puede responder la solicitud.")

    if conexion_db.estado != EstadoConexion.Pendiente:
        raise HTTPException(status_code=400, detail=f"Esta solicitud ya fue {conexion_db.estado.value}.")

    conexion_db.estado = respuesta.estado
    db.commit()
    db.refresh(conexion_db)
    return conexion_db


# 3. Ver las solicitudes que me han llegado
@router.get("/recibidas/{id_usuario}", response_model=list[ConexionResponse])
def ver_solicitudes_recibidas(id_usuario: int, id_actual: int = Depends(get_current_user), db: Session = Depends(get_db)):
    if id_usuario != id_actual:
        raise HTTPException(403, "No puedes consultar solicitudes de otro usuario.")
    solicitudes = db.query(Conexion).filter(
        Conexion.id_receptor_FK == id_usuario,
        Conexion.estado == EstadoConexion.Pendiente
    ).all()
    return solicitudes  


# 4. BÚSQUEDA DE USUARIOS (ROOMIES)
@router.get("/usuarios/buscar", response_model=List[UsuarioBusqueda])
def buscar_usuarios(
    presupuesto_max: Optional[int] = Query(None, description="Presupuesto máximo del roomie"),
    zona: Optional[str] = Query(None, description="Zona de interés (ej: Centro, Norte)"),
    ocupacion: Optional[str] = Query(None, description="Estudiante, Trabajador o Ambos"),
    db: Session = Depends(get_db)
):
    consulta_db = db.query(Usuario)
    
    if presupuesto_max:
        consulta_db = consulta_db.filter(Usuario.presupuesto <= presupuesto_max)
    if zona:
        consulta_db = consulta_db.filter(Usuario.zona_interes.ilike(f"%{zona}%"))
    if ocupacion:
        consulta_db = consulta_db.filter(Usuario.ocupacion == ocupacion)
        
    return consulta_db.all()


# 5. BÚSQUEDA DE PUBLICACIONES (ARRIENDOS) CON FILTROS DEL FRONTEND
@router.get("/publicaciones/buscar", response_model=List[PublicacionBusqueda])
def buscar_publicaciones(
    consulta: Optional[str] = Query(None, description="Ubicación (barra de búsqueda)"),
    personas: Optional[str] = Query(None, description="Cantidad de personas (uno, dos, tres, cuatro_o_mas)"),
    tipo: Optional[str] = Query(None, description="Casa o departamento"),
    mascotas: Optional[str] = Query(None, description="si o no"),
    db: Session = Depends(get_db)
):
    query = db.query(Publicacion).filter(Publicacion.estado == "Activa")
    
    if consulta:
        query = query.filter(Publicacion.ubicacion.ilike(f"%{consulta}%"))
        
    if personas:
        mapa_personas = {"uno": 1, "dos": 2, "tres": 3, "cuatro_o_mas": 4}
        cupos = mapa_personas.get(personas)
        if cupos:
            if cupos >= 4:
                query = query.filter(Publicacion.cupos_totales >= 4)
            else:
                query = query.filter(Publicacion.cupos_totales == cupos)
                
    if tipo:
        query = query.filter(Publicacion.tipo_vivienda == tipo)
        
    if mascotas:
        query = query.filter(Publicacion.mascotas == mascotas)
        
    return query.all()
