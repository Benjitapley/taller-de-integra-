"""Casos de uso del dominio Listado/Applications."""
from typing import Protocol
from backend.service_runtime.contracts import RuleViolation, DependencyUnavailable
from app.domain.publications import validate_publication, available, transition


class Repository(Protocol):
    def transaction(self): ...
    def publication(self, id, lock=False): ...
    def list_publications(self, filters, owner=None): ...
    def create(self, owner, data): ...
    def update(self, id, data): ...
    def close(self, id): ...
    def image(self, id, reference): ...
    def postulate(self, id, user_id): ...
    def application(self, id, lock=False): ...
    def applications(self, owner=None, publication=None): ...
    def change(self, id, state, reason): ...
    def event(self, application): ...


class ImagesPort(Protocol):
    def save(self, data: bytes) -> str | None: ...
    def delete(self, reference): ...

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
        rows=self.repository.list_publications(filters,owner)
        if owner is not None:
            return rows
        result=[]
        for row in rows:
            try:
                if available(row,self.occupancy)>0:
                    result.append(row)
            except DependencyUnavailable:
                continue  # No inventar vacantes de Activa sin Convivencia.
        return result

    def save(self,actor_id,data,image=None,id=None):
        data=validate_publication(data)
        if id is None and data["tipo"] == "Arrendador" and data["categoria"] != "ofrezco":
            raise RuleViolation("Una publicación de arrendador debe ofrecer un espacio.")
        reference=None
        try:
            with self.repository.transaction():
                if id is None:
                    id=self.repository.create(actor_id,data)
                else:
                    previous=self.repository.publication(id,lock=True)
                    if previous is None or previous["id_usuario"]!=actor_id:
                        raise RuleViolation("Publicación no encontrada.",404)
                    if previous["tipo"]!=data["tipo"]:
                        raise RuleViolation("El tipo original no puede modificarse.",409)
                    if previous["estado"]=="Activa" and data["cupos_totales"] < previous["cupos_totales"]:
                        raise RuleViolation("La reducción de capacidad requiere confirmar ocupación.",409)
                    self.repository.update(id,data)
                reference=self.images.save(image)
                if reference:
                    self.repository.image(id,reference)
            return id
        except Exception:
            self.images.delete(reference)
            raise

    def close(self,actor_id,id):
        with self.repository.transaction():
            row=self.repository.publication(id,lock=True)
            if row is None or row["id_usuario"]!=actor_id:
                raise RuleViolation("Publicación no encontrada.",404)
            self.repository.close(id)
        return self.get(id,actor_id)

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

    def decide(self,actor_id,id,state,reason=None):
        with self.repository.transaction():
            # Orden estable de locks: publicación antes de postulación.
            application=self.repository.application(id)
            if application is None:
                raise RuleViolation("Postulación no encontrada.",404)
            publication=self.repository.publication(application["id_publicacion"],lock=True)
            application=self.repository.application(id,lock=True)
            if transition(application,publication,actor_id,state,reason):
                application=self.repository.change(id,state,(reason or "").strip() or None)
                self.repository.event(application)
            return application
