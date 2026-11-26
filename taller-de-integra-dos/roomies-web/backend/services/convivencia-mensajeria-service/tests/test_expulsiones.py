"""SQL real con puertos de dominio simulados; no acredita login ni Gateway."""
from uuid import uuid4

import pytest

from app.models import ServiceError

pytestmark = pytest.mark.usefixtures("empty_database")


def rental(service):
    result = None
    for user in (2, 3):
        _, result, _ = service.incorporate(uuid4(), {"id_usuario": user, "id_publicacion": 7,
                                                    "id_postulacion": user, "version_capacidad": 1})
    return result["id_arriendo"]


def test_expulsion_idempotente_revoca_chat_y_confirma_ocupacion(service, repository, ports):
    identifier = rental(service)
    chat = repository.conversations(3)[0]["id_conversacion"]
    client = uuid4()
    repository.send_message(chat, 3, "Cuenta SQL", "Antes", client)
    result = service.expel(identifier, 1, 3, "Prueba")
    assert service.expel(identifier, 1, 3, "Prueba") == result
    for operation in (lambda: repository.messages(chat, 3, None, 20),
                      lambda: repository.send_message(chat, 3, "Cuenta SQL", "Antes", client)):
        with pytest.raises(ServiceError) as error:
            operation()
        assert error.value.status == 403
        assert error.value.body["codigo"] == "sin_permiso"
    assert len(ports[1].expulsion_updates) == 1
    assert ports[1].expulsion_updates[0][1]["ocupacion"] == 1
    assert repository.get(identifier, 2)["ocupacion"] == 1


@pytest.mark.parametrize("actor", [2, 3, 99])
def test_expulsion_no_concede_permiso_a_residentes_o_terceros(service, repository, actor):
    identifier = rental(service)
    with pytest.raises(ServiceError) as error:
        service.expel(identifier, actor, 3, "Prueba")
    assert error.value.status == 403
    assert repository.get(identifier, 3)["ocupacion"] == 2


def test_caida_de_listado_conserva_revocacion_y_outbox(service, repository, ports):
    identifier = rental(service)
    ports[1].expulsion_down = True
    service.expel(identifier, 1, 3, "Prueba")
    assert repository.conversations(3) == []
    ports[1].expulsion_down = False
    assert service.dispatch_expulsions() == 1
    assert service.dispatch_expulsions() == 0
