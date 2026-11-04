"""Reglas de conexión; no confundir con postulaciones o arriendos."""
from backend.service_runtime.contracts import RuleViolation


def sending(actor_id,receiver_id,supplied_sender=None):
    if supplied_sender is not None and supplied_sender!=actor_id:
        raise RuleViolation("No puedes actuar por otro usuario.",403)
    if type(receiver_id) is not int or receiver_id<1 or actor_id==receiver_id:
        raise RuleViolation("Destinatario inválido.")


def responding(connection,actor_id,state):
    if connection["id_receptor_FK"]!=actor_id:
        raise RuleViolation("Solo el destinatario puede responder.",403)
    if state not in {"Aceptada","Rechazada"}:
        raise RuleViolation("Respuesta inválida.")
    if connection["estado"]!="Pendiente":
        raise RuleViolation("La solicitud ya fue respondida.",400)


def deleting(connection,actor_id):
    if actor_id not in {connection["id_solicitante_FK"],connection["id_receptor_FK"]}:
        raise RuleViolation("Solo los participantes pueden eliminar la conexión.",403)
