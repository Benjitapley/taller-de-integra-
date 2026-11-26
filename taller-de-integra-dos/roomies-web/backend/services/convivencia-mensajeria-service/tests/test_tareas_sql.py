"""E04 sobre SQL real: permisos, paginación, retiro y concurrencia.

Ejecutar con run_isolated.py; nunca utiliza la base del usuario.
"""
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from uuid import uuid4

import psycopg
import pytest

from app.models import ServiceError
from app.repository import PostgresRepository

pytestmark = pytest.mark.usefixtures("empty_database")


@pytest.fixture
def rental(migrated_database, empty_database):
    with psycopg.connect(migrated_database) as connection:
        rental_id = connection.execute("""INSERT INTO convivencia_mensajeria.arriendo
            (id_publicacion,cupos_totales,version_capacidad) VALUES(7,4,1)
            RETURNING id_arriendo""").fetchone()[0]
        for user in (2, 3):
            operation = uuid4()
            connection.execute("INSERT INTO convivencia_mensajeria.incorporacion(id_operacion,payload) VALUES(%s,'{}')", (operation,))
            connection.execute("""INSERT INTO convivencia_mensajeria.pertenencia
                (id_arriendo,id_usuario,id_postulacion,id_operacion) VALUES(%s,%s,%s,%s)""",
                (rental_id, user, user, operation))
    return rental_id


def status(expected, operation):
    with pytest.raises(ServiceError) as error:
        operation()
    assert error.value.status == expected


def test_tarea_creada_reasignada_y_completada_persiste_en_otra_conexion(repository, rental, migrated_database):
    task = repository.create_task(rental, 2, "Tarea cruzada", "Cocina", None)
    assert task["estado"] == "Pendiente" and task["id_asignado"] is None
    assert repository.reassign_task(task["id_tarea"], 3, 3)["id_asignado"] == 3
    status(403, lambda: repository.complete_task(task["id_tarea"], 2))
    assert repository.complete_task(task["id_tarea"], 3)["estado"] == "Completada"
    rows, cursor = PostgresRepository().list_tasks(rental, 2, "Completada", None, 20)
    assert [row["id_tarea"] for row in rows] == [task["id_tarea"]]
    assert cursor is None
    with psycopg.connect(migrated_database) as connection:
        assert connection.execute("SELECT estado,fecha_completada IS NOT NULL FROM convivencia_mensajeria.tarea WHERE id_tarea=%s",
            (task["id_tarea"],)).fetchone() == ("Completada", True)
    status(409, lambda: repository.reassign_task(task["id_tarea"], 2, 2))


def test_filtro_sql_antes_del_limite_y_tres_paginas_sin_duplicados(repository, rental):
    pending, completed = [], []
    for index in range(65):
        task = repository.create_task(rental, 2, f"Tarea {index:02d}", "", 3)
        if index % 5 == 0:
            repository.complete_task(task["id_tarea"], 3)
            completed.append(task["id_tarea"])
        else:
            pending.append(task["id_tarea"])
    actual, cursor, pages = [], None, 0
    while True:
        rows, cursor = repository.list_tasks(rental, 2, "Pendiente", cursor, 20)
        assert all(row["estado"] == "Pendiente" for row in rows)
        actual.extend(row["id_tarea"] for row in rows)
        pages += 1
        if cursor is None:
            break
    assert pages == 3
    assert actual == list(reversed(pending))
    assert len(actual) == len(set(actual))
    rows, cursor = repository.list_tasks(rental, 2, "Completada", None, 20)
    assert [row["id_tarea"] for row in rows] == list(reversed(completed))
    assert cursor is None


def test_actor_ajeno_y_asignado_invalido_no_crean_ni_modifican(repository, rental):
    task = repository.create_task(rental, 2, "Protegida", None, 3)
    status(403, lambda: repository.list_tasks(rental, 99, "Pendiente", None, 20))
    status(403, lambda: repository.create_task(rental, 99, "Ajena", None, None))
    status(403, lambda: repository.reassign_task(task["id_tarea"], 99, 2))
    status(403, lambda: repository.complete_task(task["id_tarea"], 99))
    status(422, lambda: repository.create_task(rental, 2, "Inválida", None, 99))
    status(422, lambda: repository.reassign_task(task["id_tarea"], 2, 99))
    rows, _ = repository.list_tasks(rental, 2, "Pendiente", None, 20)
    assert len(rows) == 1 and rows[0]["id_asignado"] == 3


def test_retiro_desasigna_pendientes_revoca_acceso_y_permite_reasignar(repository, rental, migrated_database):
    pending = repository.create_task(rental, 2, "Pendiente", None, 3)
    completed = repository.create_task(rental, 2, "Histórica", None, 3)
    repository.complete_task(completed["id_tarea"], 3)
    with psycopg.connect(migrated_database) as connection:
        connection.execute("UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_arriendo=%s AND id_usuario=3", (rental,))
    status(403, lambda: repository.list_tasks(rental, 3, "Pendiente", None, 20))
    status(403, lambda: repository.complete_task(pending["id_tarea"], 3))
    status(403, lambda: repository.reassign_task(pending["id_tarea"], 3, 2))
    status(422, lambda: repository.create_task(rental, 2, "Retirado", None, 3))
    rows, _ = repository.list_tasks(rental, 2, "Pendiente", None, 20)
    assert rows[0]["id_asignado"] is None
    history, _ = repository.list_tasks(rental, 2, "Completada", None, 20)
    assert history[0]["id_asignado"] == 3
    assert repository.reassign_task(pending["id_tarea"], 2, 2)["id_asignado"] == 2


def test_completado_concurrente_con_retiro_no_salta_revocacion(repository, rental, migrated_database):
    task = repository.create_task(rental, 2, "Concurrente", None, 3)
    with ThreadPoolExecutor(max_workers=1) as workers:
        with psycopg.connect(migrated_database) as connection:
            connection.execute("SELECT id_usuario FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND id_usuario=3 FOR UPDATE", (rental,))
            future = workers.submit(lambda: status(403, lambda: PostgresRepository().complete_task(task["id_tarea"], 3)))
            with pytest.raises(TimeoutError):
                future.result(timeout=.15)
            connection.execute("UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_arriendo=%s AND id_usuario=3", (rental,))
        future.result(timeout=5)
    rows, _ = repository.list_tasks(rental, 2, "Pendiente", None, 20)
    assert len(rows) == 1 and rows[0]["id_asignado"] is None
