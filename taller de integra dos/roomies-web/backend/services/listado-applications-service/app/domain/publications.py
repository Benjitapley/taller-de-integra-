"""Reglas de publicaciones y postulaciones sin persistencia ni proveedores."""
from decimal import Decimal, InvalidOperation
from typing import Protocol
from backend.service_runtime.contracts import RuleViolation


class OccupancyPort(Protocol):
    def active_members(self, publication_id: int) -> int: ...


def available(publication, occupancy: OccupancyPort):
    if publication["estado"] == "Cerrada":
        return 0
    if publication["estado"] == "Disponible":
        return publication["cupos_totales"]
    count=occupancy.active_members(publication["id_publicacion"])
    if type(count) is not int or not 0 <= count <= publication["cupos_totales"]:
        raise RuleViolation("Ocupación inconsistente.",503)
    return publication["cupos_totales"]-count


def validate_publication(data):
    limits={"titulo":200,"ubicacion":250,"descripcion":5000}
    normalized=dict(data)
    for key,limit in limits.items():
        value=data.get(key)
        if not isinstance(value,str) or not value.strip() or len(value)>limit or "\x00" in value:
            raise RuleViolation("Completa título, ubicación y descripción dentro de sus límites.")
        normalized[key]=value.strip()
    choices={"tipo":{"Arrendador","Compartida"},"categoria":{"busco","ofrezco"},"tipo_vivienda":{"casa","departamento","habitacion"},"mascota":{"si","no"}}
    if any(data.get(key) not in values for key,values in choices.items()):
        raise RuleViolation("Tipo o características de publicación inválidos.")
    try:
        price=Decimal(str(data["precio"]))
        if not price.is_finite() or price<0 or price>=Decimal("1000000000000") or price.as_tuple().exponent < -2:
            raise ValueError()
        total=int(str(data["cupos_totales"]))
        if str(total)!=str(data["cupos_totales"]) or not 1<=total<=2147483647:
            raise ValueError()
    except (ValueError,TypeError,KeyError,InvalidOperation):
        raise RuleViolation("Precio o cupos inválidos.") from None
    normalized.update(precio=price,cupos_totales=total)
    flag=data.get("permitir_comentarios",False)
    if flag not in (True,False,"true","false"):
        raise RuleViolation("Configuración de comentarios inválida.")
    normalized["permitir_comentarios"]=flag in (True,"true")
    return {k:normalized[k] for k in (*limits,*choices,"precio","cupos_totales","permitir_comentarios")}


TRANSITIONS={"Pendiente":{"Preseleccionada","Rechazada","Cancelada"},"Preseleccionada":{"Aceptada","Rechazada","Cancelada"},"Aceptada":set(),"Rechazada":set(),"Cancelada":set()}


def transition(application, publication, actor_id, target, reason):
    if target not in TRANSITIONS:
        raise RuleViolation("Estado de postulación inválido.")
    if target=="Cancelada":
        if application["id_usuario"]!=actor_id:
            raise RuleViolation("Solo el postulante puede cancelar.",403)
    elif publication["id_usuario"]!=actor_id:
        raise RuleViolation("Solo el arrendador puede decidir.",403)
    if application["estado"]==target:
        return False
    if target not in TRANSITIONS.get(application["estado"],set()):
        raise RuleViolation("Transición de postulación inválida.",409)
    if publication["estado"]=="Cerrada" and target not in {"Rechazada","Cancelada"}:
        raise RuleViolation("La publicación está cerrada.",409)
    if reason is not None and (not isinstance(reason,str) or len(reason)>1000 or "\x00" in reason):
        raise RuleViolation("Motivo inválido.")
    if target in {"Rechazada","Cancelada"} and not (reason or "").strip():
        raise RuleViolation("Indica un motivo.")
    return True
