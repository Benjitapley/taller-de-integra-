import os

from .test_contract import add, client


def test_retiro_actualiza_cupos_cierra_y_no_reabre(repository):
    publication = add(repository)
    web, service = client(repository)
    headers = {'X-Roomies-Service': os.environ['ROOMIES_INTERNAL_TOKEN']}
    path = f"/internal/publicaciones/{publication}/retiros"
    pending = repository.postulate(publication, 2)
    body = {'id_arriendo': 1, 'ocupacion': 1, 'version_ocupacion': 3, 'finalizado': False}
    assert web.put(path, headers=headers, json=body).status_code == 200
    assert repository.publication(publication)['ocupacion_confirmada'] == 1
    assert web.put(path, headers=headers, json={**body, 'ocupacion': 0, 'version_ocupacion': 4, 'finalizado': True}).status_code == 200
    row = repository.publication(publication)
    assert row['estado'] == 'Cerrada' and row['ocupacion_confirmada'] == 0
    assert repository.application(pending['id_postulacion'])['estado'] == 'Cancelada'
    assert web.put(path, headers=headers, json=body).status_code == 200
    assert repository.publication(publication)['estado'] == 'Cerrada'
    assert repository.publication(publication)['ocupacion_confirmada'] == 0
    assert web.put(path, headers=headers, json={**body, 'version_ocupacion': 5}).status_code == 200
    assert repository.publication(publication)['estado'] == 'Cerrada'


def test_owner_interno_y_proyeccion_no_son_api_publica(repository):
    publication = add(repository)
    web, _ = client(repository)
    path = f"/internal/publicaciones/{publication}"
    headers = {'X-Roomies-Service': os.environ['ROOMIES_INTERNAL_TOKEN']}
    assert web.get(path).status_code == 401
    assert web.get(path, headers={'X-Roomies-Service': 'wrong'}).status_code == 403
    assert web.get(path, headers=headers).json()['id_propietario'] == 1
    body = {'id_arriendo': 1, 'ocupacion': 1, 'version_ocupacion': 3, 'finalizado': True}
    assert web.put(path + '/retiros', headers=headers, json=body).status_code == 422
    assert web.put(path + '/retiros', json={**body, 'ocupacion': 0}).status_code == 403
