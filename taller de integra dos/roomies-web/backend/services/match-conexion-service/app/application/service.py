"""Coordinación por puertos, sin SQL ni frameworks."""
from typing import Protocol
from backend.service_runtime.contracts import RuleViolation
from app.domain.connections import sending,responding,deleting


class ConnectionsRepository(Protocol):
    def transaction(self): ...
    def create(self,sender,receiver): ...
    def get(self,id,lock=False): ...
    def change(self,id,state): ...
    def delete(self,id): ...
    def own(self,actor_id,view): ...
    def count(self): ...


class ProfilesPort(Protocol):
    def search(self,filters): ...


class Connections:
    def __init__(self,repository:ConnectionsRepository,profiles:ProfilesPort):
        self.repository,self.profiles=repository,profiles

    def send(self,actor_id,receiver_id,supplied_sender=None):
        sending(actor_id,receiver_id,supplied_sender)
        if not self.profiles.search({"ids":str(receiver_id)}):
            raise RuleViolation("Usuario no encontrado.",404)
        with self.repository.transaction():
            return self.repository.create(actor_id,receiver_id)

    def respond(self,actor_id,id,state):
        with self.repository.transaction():
            connection=self.repository.get(id,lock=True)
            if connection is None:
                raise RuleViolation("Conexión no encontrada.",404)
            responding(connection,actor_id,state)
            return self.repository.change(id,state)

    def delete(self,actor_id,id):
        with self.repository.transaction():
            connection=self.repository.get(id,lock=True)
            if connection is None:
                raise RuleViolation("Conexión no encontrada.",404)
            deleting(connection,actor_id)
            self.repository.delete(id)

    def own(self,actor_id,view,requested_user=None):
        if requested_user is not None and actor_id!=requested_user:
            raise RuleViolation("No puedes consultar conexiones de otra cuenta.",403)
        return self.repository.own(actor_id,view)
