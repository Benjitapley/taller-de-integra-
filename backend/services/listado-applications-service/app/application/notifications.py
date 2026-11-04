"""Entrega al menos una vez de eventos persistidos, desacoplada del transporte."""
from typing import Protocol

class Outbox(Protocol):
    def pending_events(self): ...
    def delivered(self, event_key): ...

class Notifications(Protocol):
    def send(self, event): ...

def dispatch(repository: Outbox, notifications: Notifications):
    delivered = 0
    for event in repository.pending_events():
        try:
            notifications.send(event)
            repository.delivered(event["event_key"])
            delivered += 1
        except Exception:
            continue  # Sigue pendiente; el receptor deduplica por event_key.
    return delivered
