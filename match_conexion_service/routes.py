from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

router = APIRouter(prefix="/conexiones", tags=["Conexiones"])

# Endpoint para enviar solicitud (FR-15)
@router.post("/enviar/{usuario_destino_id}")
def enviar_solicitud(usuario_destino_id: int):
    # Aquí irá la lógica de SQLAlchemy para insertar en la tabla
    return {
        "mensaje": f"Solicitud de conexión enviada al usuario {usuario_destino_id}", 
        "estado": "Pendiente"
    }

# Endpoint para aceptar solicitud (FR-16)
@router.put("/{conexion_id}/aceptar")
def aceptar_solicitud(conexion_id: int = Path(..., description="ID de la conexión a aceptar")):
    # Aquí irá el UPDATE en la base de datos cambiando a EstadoConexion.ACEPTADA
    return {
        "mensaje": f"Conexión {conexion_id} aceptada exitosamente", 
        "estado": "Aceptada"
    }

# Endpoint para rechazar solicitud (FR-16)
@router.put("/{conexion_id}/rechazar")
def rechazar_solicitud(conexion_id: int = Path(..., description="ID de la conexión a rechazar")):
    # Aquí irá el UPDATE cambiando a EstadoConexion.RECHAZADA
    return {
        "mensaje": f"Conexión {conexion_id} rechazada", 
        "estado": "Rechazada"
    }

# Endpoint para eliminar conexión (FR-17)
@router.delete("/{conexion_id}")
def eliminar_conexion(conexion_id: int):
    # Aquí irá el DELETE en la base de datos
    return {
        "mensaje": f"Conexión {conexion_id} eliminada"
    }