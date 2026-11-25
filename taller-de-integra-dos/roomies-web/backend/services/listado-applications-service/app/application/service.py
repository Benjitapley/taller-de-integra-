"""Casos de uso del dominio Listado/Applications."""
from typing import Protocol
from backend.service_runtime.contracts import RuleViolation, DependencyUnavailable
from app.domain.publications import validate_publication, available, transition
from app.domain import pagination
from app.application.images import save_publication
from app.application.admissions import Admissions


class Repository(Protocol):
    def transaction(self): ...
    def publication(self, id, lock=False): ...
    def list_publications(self, filters, owner=None): ...
    def create(self, owner, data): ...
    def update(self, id, data): ...
    def close(self, id): ...
    def images(self, id): ...
    def image(self, id, reference, order): ...
    def order_image(self, id, image_id, order): ...
    def remove_image(self, id, image_id): ...
    def postulate(self, id, user_id): ...
    def application(self, id, lock=False): ...
    def applications(self, owner=None, publication=None): ...
    def change(self, id, state, reason): ...
    def event(self, application): ...


class ImagesPort(Protocol):
    def upload(self, path: str, data: bytes, mime: str) -> str: ...
    def delete(self, path: str): ...

class OwnersPort(Protocol):
    def exists(self, user_id: int) -> bool: ...


class Publications:
    def __init__(self, repository: Repository, occupancy, images: ImagesPort, owners: OwnersPort | None = None):
        self.repository,self.occupancy,self.images=repository,occupancy,images
        self.owners = owners

    def get(self,id,owner=None):
        row=self.repository.publication(id)
        if row is None or (owner is not None and row["id_usuario"]!=owner):
            raise RuleViolation("Publicación no encontrada.",404)
        return row

    def list(self,filters,owner=None):
        limit=filters.get("limite",20)
        if type(limit) is not int or not 1 <= limit <= 100:
            raise RuleViolation("Límite inválido.")
        scope=pagination.context(filters,owner)
        query={**filters,"limite":limit+1}
        if filters.get("cursor") is not None:
            query["after"]=pagination.decode(filters["cursor"],scope)
        rows=self.repository.list_publications(query,owner)
        items=rows[:limit]
        return {"items":items,"siguiente_cursor":pagination.encode(items[-1],scope) if len(rows)>limit else None}

    def save(self,actor_id,data,image=None,id=None,retained=None,key=None):
        previous = self.get(id, actor_id) if id is not None else None
        has_rules = "reglas" in data or "reglas_arrendador" in data
        if "ubicacion" not in data:
            try:
                region, commune = (int(str(data[key])) for key in ("id_region", "id_comuna"))
            except (KeyError, ValueError):
                raise RuleViolation("Región o comuna inválida.") from None
            if previous and (region, commune) == (previous.get("id_region"), previous.get("id_comuna")):
                location = previous["ubicacion"]
            else:
                location = self.repository.location(region, commune)
            data = {**data, "ubicacion": location}
        data=validate_publication(data)
        if previous is not None and not has_rules:
            data.pop("reglas")
        if id is None and data["tipo"] == "Arrendador" and data["categoria"] != "ofrezco":
            raise RuleViolation("Una publicación de arrendador debe ofrecer un espacio.")
        self.repository.validate_location(data["id_region"],data["id_comuna"])
        files=[(image,None)] if isinstance(image,bytes) else image
        return save_publication(self,actor_id,data,files,id,retained,key)

    def close(self,actor_id,id):
        with self.repository.transaction():
            row=self.repository.publication(id,lock=True)
            if row is None or row["id_usuario"]!=actor_id:
                raise RuleViolation("Publicación no encontrada.",404)
            Admissions(self).guard_mutation(id)
            self.repository.close(id)
        return self.get(id,actor_id)

    def occupancy_update(self,id,count,version,finalizado=False):
        with self.repository.transaction():
            row=self.repository.publication(id,lock=True)
            if row is None:
                raise RuleViolation("Publicación no encontrada.",404)
            if finalizado and count != 0:
                raise RuleViolation("Finalizar requiere ocupación cero.",422)
            self.occupancy_update_locked(row,count,version)
            if finalizado and version >= row["version_ocupacion"]:
                self.repository.close(id)
        return self.get(id)

    def occupancy_update_locked(self,row,count,version):
        if count > row["cupos_totales"]:
            raise RuleViolation("Ocupación mayor que la capacidad.",409)
        if version < row["version_ocupacion"]:
            return
        if version == row["version_ocupacion"] and row["ocupacion_confirmada"] is not None:
            if count != row["ocupacion_confirmada"]:
                raise RuleViolation("La versión de ocupación corresponde a otros datos.",409)
            return
        self.repository.update_occupancy(row["id_publicacion"],count,version)

    def postulate(self,actor_id,id):
        with self.repository.transaction():
            row=self.repository.publication(id,lock=True)
            if row is None:
                raise RuleViolation("Publicación no encontrada.",404)
            if row["tipo"]!="Arrendador" or row["id_usuario"]==actor_id:
                raise RuleViolation("Solo puedes postular a publicaciones de otro arrendador.",403)
            if self.owners is not None and not self.owners.exists(row["id_usuario"]):
                raise RuleViolation("La publicación requiere revisar su propietario antes de recibir postulaciones.",409)
            if row["estado"]=="Cerrada" or available(row,self.occupancy)<1:
                raise RuleViolation("No hay cupos para postular.",409)
            return self.repository.postulate(id,actor_id)

    def applicants(self,actor_id,id):
        self.get(id,actor_id)
        return self.repository.applications(publication=id)

    def application_page(self,actor_id,publication=None,limit=20,cursor=None,state=None):
        # Ownership is checked before interpreting a cursor from the caller.
        if publication is not None:
            self.get(publication,actor_id)
        if type(limit) is not int or not 1 <= limit <= 100:
            raise RuleViolation("Límite inválido.")
        scope=pagination.context({"lista_privada":"postulaciones","publicacion":publication,"estado":state},actor_id)
        after=pagination.decode(cursor,scope) if cursor is not None else None
        rows=self.repository.applications(owner=actor_id if publication is None else None,publication=publication,limit=limit+1,after=after,state=state)
        items=rows[:limit]
        last={"fecha_publicacion":items[-1]["fecha_postulacion"],"id_publicacion":items[-1]["id_postulacion"]} if items else None
        return {"items":items,"siguiente_cursor":pagination.encode(last,scope) if len(rows)>limit else None}

    def withdraw(self,actor_id,id):
        with self.repository.transaction():
            row=self.repository.application(id)
            if row is None:
                raise RuleViolation("Postulación no encontrada.",404)
            publication=self.repository.publication(row["id_publicacion"],lock=True)
            row=self.repository.application(id,lock=True)
            if row["id_usuario"]!=actor_id:
                raise RuleViolation("Solo el postulante puede retirar.",403)
            operation=Admissions(self).operations.latest(id)
            if operation and operation["estado"]=="Pendiente":
                raise RuleViolation("La incorporación sigue en curso; consulta su resultado.",409)
            if transition(row,publication,actor_id,"Cancelada","Retiro voluntario"):
                row=self.repository.change(id,"Cancelada","Retiro voluntario")
                self.repository.event(row)
            return Admissions(self).view(row,operation)

    def decide(self,actor_id,id,state,reason=None,key=None):
        if state=="Aceptada":
            return Admissions(self).accept(actor_id,id,reason,key)
        with self.repository.transaction():
            # Orden estable de locks: publicación antes de postulación.
            application=self.repository.application(id)
            if application is None:
                raise RuleViolation("Postulación no encontrada.",404)
            publication=self.repository.publication(application["id_publicacion"],lock=True)
            application=self.repository.application(id,lock=True)
            if publication["id_usuario"]!=actor_id:
                raise RuleViolation("Solo el arrendador puede decidir.",403)
            operation=Admissions(self).operations.latest(id)
            if operation and operation["estado"]=="Pendiente":
                raise RuleViolation("La aceptación está en curso; consulta su resultado.",409)
            if transition(application,publication,actor_id,state,reason):
                application=self.repository.change(id,state,(reason or "").strip() or None)
                self.repository.event(application)
            return 200,Admissions(self).view(application,operation)
