import pytest
from app.domain.connections import sending, responding, deleting
from backend.service_runtime.contracts import RuleViolation

ROW = {"id_solicitante_FK": 1, "id_receptor_FK": 2, "estado": "Pendiente"}

@pytest.mark.parametrize("sender,receiver,claimed", [(1, 1, None), (1, 2, 3)])
def test_sender_proviene_de_identidad(sender, receiver, claimed):
    with pytest.raises(RuleViolation): sending(sender, receiver, claimed)

@pytest.mark.parametrize("actor", [1, 3])
def test_solo_receptor_decide(actor):
    with pytest.raises(RuleViolation): responding(ROW, actor, "Aceptada")

def test_solo_participantes_borran():
    deleting(ROW, 1)
    deleting(ROW, 2)
    with pytest.raises(RuleViolation): deleting(ROW, 3)

def test_conexion_aceptada_no_se_decide_de_nuevo():
    with pytest.raises(RuleViolation): responding({**ROW, "estado": "Aceptada"}, 2, "Rechazada")
