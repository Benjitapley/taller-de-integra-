from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from match_conexion_service.database import get_db
from match_conexion_service.models import Conexion, EstadoConexion, Match, Usuario, Publicacion
from match_conexion_service.schemas import (
    ConexionCreate,
    ConexionResponse,
    ConexionUpdate,
    MatchResponse,
    PublicacionBusqueda,
    UsuarioBusqueda,
)

router = APIRouter(
    prefix="/conexiones",
    tags=["Conexiones"]
)

# 1. ENVIAR solicitud de conexión
@router.post("/", response_model=ConexionResponse, status_code=status.HTTP_201_CREATED)
def enviar_solicitud(conexion: ConexionCreate, db: Session = Depends(get_db)):
    if conexion.id_solicitante_FK == conexion.id_receptor_FK:
        raise HTTPException(status_code=400, detail="No puedes enviarte una solicitud a ti mismo.")

    conexion_existente = db.query(Conexion).filter(
        (
            (Conexion.id_solicitante_FK == conexion.id_solicitante_FK)
            & (Conexion.id_receptor_FK == conexion.id_receptor_FK)
        )
        | (
            (Conexion.id_solicitante_FK == conexion.id_receptor_FK)
            & (Conexion.id_receptor_FK == conexion.id_solicitante_FK)
        ),
        Conexion.estado.in_(
            (EstadoConexion.Pendiente, EstadoConexion.Aceptada)
        ),
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

    conexion_db.estado = EstadoConexion(respuesta.estado.value)
    if respuesta.estado.value == EstadoConexion.Aceptada.value:
        db.add(Match(id_conexion_FK=id_conexion))
    db.commit()
    db.refresh(conexion_db)
    return conexion_db


# 3. Ver las solicitudes que me han llegado
@router.get("/recibidas/{id_usuario}", response_model=list[ConexionResponse])
def ver_solicitudes_recibidas(id_usuario: int, db: Session = Depends(get_db)):
    solicitudes = db.query(Conexion).filter(
        Conexion.id_receptor_FK == id_usuario,
        Conexion.estado == EstadoConexion.Pendiente
    ).all()
    return solicitudes  


@router.get("/enviadas/{id_usuario}", response_model=list[ConexionResponse])
def ver_solicitudes_enviadas(id_usuario: int, db: Session = Depends(get_db)):
    return db.query(Conexion).filter(
        Conexion.id_solicitante_FK == id_usuario
    ).order_by(Conexion.fecha_solicitud.desc()).all()


@router.get("/matches/{id_usuario}", response_model=list[ConexionResponse])
def ver_matches(id_usuario: int, db: Session = Depends(get_db)):
    return db.query(Conexion).filter(
        (
            (Conexion.id_solicitante_FK == id_usuario)
            | (Conexion.id_receptor_FK == id_usuario)
        ),
        Conexion.estado == EstadoConexion.Aceptada,
    ).order_by(Conexion.fecha_solicitud.desc()).all()


@router.get("/admin/verificaciones", response_model=list[ConexionResponse])
def listar_verificaciones(
    solo_pendientes: bool = Query(True),
    db: Session = Depends(get_db),
):
    query = db.query(Conexion)
    if solo_pendientes:
        query = query.filter(Conexion.verificada.is_(False))
    return query.order_by(Conexion.fecha_solicitud.asc()).all()


@router.put("/admin/verificaciones/{id_conexion}", response_model=ConexionResponse)
def verificar_conexion(id_conexion: int, db: Session = Depends(get_db)):
    conexion_db = db.query(Conexion).filter(Conexion.id_conexion == id_conexion).first()
    if not conexion_db:
        raise HTTPException(status_code=404, detail="Solicitud de conexión no encontrada.")
    if conexion_db.estado != EstadoConexion.Aceptada:
        raise HTTPException(
            status_code=409,
            detail="Solo se pueden verificar conexiones aceptadas.",
        )
    conexion_db.verificada = True
    db.commit()
    db.refresh(conexion_db)
    return conexion_db


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