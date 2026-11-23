"""Aceptación confirmada por Convivencia, con reintentos de la misma operación."""
from uuid import UUID
import psycopg
from backend.service_runtime.contracts import RuleViolation, DependencyUnavailable
from app.domain.publications import transition
from app.infrastructure.admissions import AdmissionsRepository
from app.infrastructure.clients import HttpIncorporations, IncorporationRejected


class AdmissionError(RuleViolation):
    def __init__(self,code,message,status=409):
        super().__init__(message,status)
        self.code=code


def operation_key(value):
    try:
        if not isinstance(value,str) or str(UUID(value))!=value:
            raise ValueError()
        return value
    except (ValueError,TypeError,AttributeError):
        raise AdmissionError("INVALID_REQUEST","Aceptar requiere Idempotency-Key UUID canónico.",422) from None


class Admissions:
    def __init__(self,service,incorporations=None):
        self.service=service
        self.repository=service.repository
        self.operations=AdmissionsRepository(self.repository)
        self.incorporations=incorporations or HttpIncorporations()

    @staticmethod
    def payload(operation):
        return {name:operation[name] for name in ("id_postulacion","id_publicacion","id_usuario","version_capacidad")}

    def detail(self,actor,application):
        row=self.repository.application(application)
        if row is None:
            raise RuleViolation("Postulación no encontrada.",404)
        publication=self.service.get(row["id_publicacion"])
        if actor not in {row["id_usuario"],publication["id_usuario"]}:
            raise RuleViolation("Postulación no encontrada.",404)
        return self.view(row,self.operations.latest(application))

    @staticmethod
    def view(application,operation):
        result={**application,"id_arriendo":application.get("id_arriendo"),"incorporacion_pendiente":bool(operation and operation["estado"]=="Pendiente"),"operacion":None}
        if operation:
            result["operacion"]={"id_operacion":str(operation["id_operacion"]),"estado":operation["estado"]}
            if operation["codigo_error"]:
                result["operacion"]["codigo_error"]=operation["codigo_error"]
        return result

    def accept(self,actor,application,reason,key):
        key=operation_key(key)
        request={"estado":"Aceptada","motivo":reason}
        try:
            with self.repository.transaction():
                row=self.repository.application(application)
                if row is None: raise RuleViolation("Postulación no encontrada.",404)
                publication=self.repository.publication(row["id_publicacion"],lock=True)
                row=self.repository.application(application,lock=True)
                if publication["id_usuario"]!=actor:
                    raise RuleViolation("Solo el arrendador puede decidir.",403)
                operation=self.operations.operation(key)
                if operation:
                    if operation["id_actor"]!=actor or operation["id_postulacion"]!=application or operation["solicitud"]!=request:
                        raise AdmissionError("IDEMPOTENCY_CONFLICT","La clave corresponde a otra decisión.")
                else:
                    previous=self.operations.latest(application)
                    if previous and previous["estado"] in {"Pendiente","Confirmada"}:
                        raise AdmissionError("APPLICATION_ALREADY_PROCESSED","Consulta la operación existente antes de volver a aceptar.")
                    transition(row,publication,actor,"Aceptada",reason)
                    operation=self.operations.insert(key,actor,row,publication,request)
        except psycopg.errors.UniqueViolation:
            raise AdmissionError("IDEMPOTENCY_CONFLICT","La clave o postulación ya tiene otra operación.") from None
        try: self.deliver(key)
        except DependencyUnavailable: pass
        operation=self.operations.operation(key)
        if operation["estado"]!="Pendiente":
            return operation["http_status"],operation["resultado"]
        return 202,self.detail(actor,application)

    def deliver(self,key):
        with self.operations.delivery(key) as acquired:
            if not acquired: return
            operation=self.operations.operation(key)
            if operation is None or operation["estado"]!="Pendiente": return
            try:
                receipt=self.incorporations.incorporate(self.payload(operation),str(operation["id_operacion"]))
            except IncorporationRejected as error:
                with self.repository.transaction():
                    self.repository.publication(operation["id_publicacion"],lock=True)
                    self.repository.application(operation["id_postulacion"],lock=True)
                    reservation=self.operations.reservation(key)
                    if reservation and reservation["estado"]!="Liberada":
                        return  # Convivencia debe confirmar su compensación antes de publicar el error.
                    body={"code":error.code,"detail":error.message}
                    result={**self.view(self.repository.application(operation["id_postulacion"]),{**operation,"estado":"Rechazada","codigo_error":error.code}),**body}
                    self.operations.finish(key,error.status,body,error.code,result)
                return
            except DependencyUnavailable:
                return
            with self.repository.transaction():
                self.repository.publication(operation["id_publicacion"],lock=True)
                application=self.repository.application(operation["id_postulacion"],lock=True)
                reservation=self.operations.reservation(key)
                if not reservation or reservation["estado"]=="Liberada":
                    raise DependencyUnavailable("El recibo no tiene una reserva firme.")
                if reservation["id_arriendo"] is not None and reservation["id_arriendo"]!=receipt["id_arriendo"]:
                    raise DependencyUnavailable("El recibo y la confirmación no coinciden.")
                self.repository.query("UPDATE listado_applications.postulacion SET estado='Aceptada',id_arriendo=%s,actualizada_en=clock_timestamp() WHERE id_postulacion=%s RETURNING id_postulacion",(receipt["id_arriendo"],application["id_postulacion"]))
                application=self.repository.application(application["id_postulacion"])
                self.repository.event(application)
                result=self.view(application,{**operation,"estado":"Confirmada"})
                self.operations.finish(key,200,receipt,result=result)

    def recover(self):
        for operation in self.operations.pending():
            try: self.deliver(operation["id_operacion"])
            except Exception: continue  # El ledger permanece pendiente hasta recuperar la dependencia.

    def guard_mutation(self,publication):
        if self.operations.busy(publication):
            raise AdmissionError("ADMISSION_IN_PROGRESS","Hay una incorporación pendiente; reintenta después de recuperar su resultado.")

    def reserve(self,publication,key,payload):
        key=operation_key(key)
        if str(payload.get("id_operacion"))!=key:
            raise AdmissionError("IDEMPOTENCY_CONFLICT","La reserva debe conservar la clave de operación.")
        with self.repository.transaction():
            row=self.repository.publication(publication,lock=True)
            if row is None: raise RuleViolation("Publicación no encontrada.",404)
            application=self.repository.application(payload["id_postulacion"],lock=True)
            operation=self.operations.operation(key)
            expected={k:payload[k] for k in ("id_postulacion","id_publicacion","id_usuario","version_capacidad")}
            if not operation or self.payload(operation)!=expected or payload["id_publicacion"]!=publication:
                raise AdmissionError("APPLICATION_NOT_ACCEPTED","No existe una intención autorizada para esta incorporación.")
            reservation=self.operations.reservation(key)
            if reservation:
                if reservation["estado"]=="Liberada":
                    raise AdmissionError("APPLICATION_NOT_ACCEPTED","La reserva ya fue liberada.")
            else:
                if operation["estado"]!="Pendiente" or not application or application["estado"]!="Preseleccionada":
                    raise AdmissionError("APPLICATION_NOT_ACCEPTED","La postulación no tiene una aceptación pendiente.")
                if row["estado"]=="Cerrada": raise AdmissionError("PUBLICATION_CLOSED","La publicación está cerrada.")
                if row["version_capacidad"]!=payload["version_capacidad"]:
                    raise AdmissionError("CAPACITY_VERSION_CONFLICT","La capacidad cambió.")
                if row["ocupacion_confirmada"] is None: raise DependencyUnavailable()
                if row["cupos_totales"]-row["ocupacion_confirmada"]-self.operations.reserved(publication)<1:
                    raise AdmissionError("NO_CAPACITY","No quedan cupos disponibles.")
                self.operations.reserve(key)
            return {**expected,"id_reserva":key,"cupos_totales":row["cupos_totales"]}

    def reservation_update(self,publication,key,reservation,projection=None):
        key=operation_key(key)
        if str(reservation)!=key:
            raise AdmissionError("IDEMPOTENCY_CONFLICT","La reserva no corresponde a la operación.")
        with self.repository.transaction():
            row=self.repository.publication(publication,lock=True)
            operation=self.operations.operation(key)
            saved=self.operations.reservation(key)
            if not row or not operation or operation["id_publicacion"]!=publication or not saved:
                raise AdmissionError("APPLICATION_NOT_ACCEPTED","Reserva no encontrada.")
            if projection is None:
                if saved["estado"]=="Confirmada": raise AdmissionError("IDEMPOTENCY_CONFLICT","La reserva confirmada no puede liberarse.")
                self.operations.release(key)
            else:
                if saved["estado"]=="Liberada": raise AdmissionError("IDEMPOTENCY_CONFLICT","La reserva ya fue liberada.")
                if saved["proyeccion"] is not None and saved["proyeccion"]!=projection:
                    raise AdmissionError("IDEMPOTENCY_CONFLICT","La confirmación ya tiene otro contenido.")
                if operation["estado"]=="Confirmada" and operation["respuesta"]["id_arriendo"]!=projection["id_arriendo"]:
                    raise AdmissionError("IDEMPOTENCY_CONFLICT","El arriendo no coincide con el recibo.")
                self.service.occupancy_update_locked(row,projection["ocupacion"],projection["version_ocupacion"])
                self.operations.confirm(key,projection)
        return {"success":True}
