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


@pytest.fixture
def publications_client(monkeypatch):
    import httpx
    from app.infrastructure.clients import HttpPublications
    monkeypatch.setenv("ROOMIES_LOCAL_MODE","1")
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE","disposable")
    monkeypatch.setenv("LISTADO_UPSTREAM_URL","http://127.0.0.1:8002")
    publication={"id_publicacion":7,"titulo":"Prueba","precio":999999999999,"ubicacion":"Temuco","tipo":"Arrendador","cupos_totales":3,"tipo_vivienda":"casa","mascota":"no"}
    response={"items":[publication],"siguiente_cursor":None}
    requests=[]
    def handler(request):
        requests.append(request)
        return httpx.Response(200,json=response)
    original=httpx.Client
    monkeypatch.setattr(httpx,"Client",lambda **options:original(**options,transport=httpx.MockTransport(handler)))
    return HttpPublications(),response,requests


def test_match_adapta_envelope_publicaciones_sin_cambiar_arreglo_legacy(publications_client):
    client,response,requests=publications_client
    results=client.search({"tipo_vivienda":"casa"})
    assert results[0]["id_publicacion_PK"]==7 and results[0]["precio"]==999999999999
    assert results[0]["mascotas"]=="no"
    assert requests[0].url.params["limite"]=="100"
    assert requests[0].url.params["tipo_vivienda"]=="casa"


def test_match_no_finge_vacio_ante_envelope_invalido(publications_client):
    from backend.service_runtime.contracts import DependencyUnavailable
    client,response,_=publications_client
    response["items"]="incorrecto"
    with pytest.raises(DependencyUnavailable): client.search({})
