from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, text
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
    if conexion.id_solicitante_FK is not None and conexion.id_solicitante_FK != id_actual:
        raise HTTPException(403, "No puedes enviar solicitudes en nombre de otro usuario.")
    if conexion.id_receptor_FK == id_actual:
        raise HTTPException(422, "No puedes enviarte una solicitud.")
    if db.query(Usuario).filter(Usuario.id_usuario_PK == conexion.id_receptor_FK).first() is None:
        raise HTTPException(404, "Usuario no encontrado.")
    # Serializar ambos sentidos del mismo par sin cambiar el esquema existente.
    par = ":".join(map(str, sorted((id_actual, conexion.id_receptor_FK))))
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:par, 0))"), {"par": par})
    conexion_existente = db.query(Conexion).filter(
        or_(and_(Conexion.id_solicitante_FK == id_actual, Conexion.id_receptor_FK == conexion.id_receptor_FK),
            and_(Conexion.id_solicitante_FK == conexion.id_receptor_FK, Conexion.id_receptor_FK == id_actual)),
        Conexion.estado.in_([EstadoConexion.Pendiente, EstadoConexion.Aceptada])
    ).first()

    if conexion_existente:
        raise HTTPException(status_code=400, detail="Ya existe una solicitud pendiente entre estos usuarios.")

    nueva_conexion = Conexion(
        id_solicitante_FK=id_actual,
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

    if respuesta.estado.value not in {"Aceptada", "Rechazada"}:
        raise HTTPException(422, "Selecciona Aceptada o Rechazada.")

    conexion_db.estado = EstadoConexion(respuesta.estado.value)
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


@router.get("/recibidas", response_model=list[ConexionResponse])
def recibidas_propias(id_actual: int = Depends(get_current_user), db: Session = Depends(get_db)):
    return ver_solicitudes_recibidas(id_actual, id_actual, db)


@router.get("/enviadas", response_model=list[ConexionResponse])
def enviadas_propias(id_actual: int = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Conexion).filter(Conexion.id_solicitante_FK == id_actual).all()


@router.get("/aceptadas", response_model=list[ConexionResponse])
def aceptadas_propias(id_actual: int = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Conexion).filter(
        or_(Conexion.id_solicitante_FK == id_actual, Conexion.id_receptor_FK == id_actual),
        Conexion.estado == EstadoConexion.Aceptada).all()


@router.delete("/{id_conexion}", status_code=204)
def eliminar_conexion(id_conexion: int, id_actual: int = Depends(get_current_user), db: Session = Depends(get_db)):
    conexion = db.query(Conexion).filter(Conexion.id_conexion == id_conexion).with_for_update().first()
    if conexion is None:
        raise HTTPException(404, "Conexión no encontrada.")
    if id_actual not in {conexion.id_solicitante_FK, conexion.id_receptor_FK}:
        raise HTTPException(403, "Solo los participantes pueden eliminar la conexión.")
    db.delete(conexion)
    db.commit()


# 4. BÚSQUEDA DE USUARIOS (ROOMIES)
@router.get("/usuarios/buscar", response_model=List[UsuarioBusqueda])
def buscar_usuarios(
    presupuesto_max: Optional[int] = Query(None, ge=0, le=2147483647, description="Presupuesto máximo del roomie"),
    zona: Optional[str] = Query(None, max_length=250, description="Zona de interés"),
    ocupacion: Optional[str] = Query(None, max_length=100, description="Estudiante, Trabajador o Ambos"),
    db: Session = Depends(get_db)
):
    return buscar_perfiles(db.query(Usuario), presupuesto_max, zona, ocupacion)


@router.get("/usuarios/otros", response_model=List[UsuarioBusqueda])
def buscar_otros_usuarios(
    presupuesto_max: Optional[int] = Query(None, ge=0, le=2147483647),
    zona: Optional[str] = Query(None, max_length=250),
    ocupacion: Optional[str] = Query(None, max_length=100),
    id_actual: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consulta = db.query(Usuario).filter(Usuario.id_usuario_PK != id_actual)
    return buscar_perfiles(consulta, presupuesto_max, zona, ocupacion)


def buscar_perfiles(consulta_db, presupuesto_max, zona, ocupacion):
    
    if presupuesto_max is not None:
        consulta_db = consulta_db.filter(Usuario.presupuesto <= presupuesto_max)
    if zona:
        consulta_db = consulta_db.filter(Usuario.zona_interes.ilike(f"%{zona}%"))
    if ocupacion:
        consulta_db = consulta_db.filter(Usuario.ocupacion == ocupacion)
        
    return consulta_db.all()


@router.get("/usuarios/{id_usuario}", response_model=UsuarioBusqueda)
def perfil_publico(id_usuario: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario_PK == id_usuario).first()
    if usuario is None:
        raise HTTPException(404, "Usuario no encontrado.")
    return usuario


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
