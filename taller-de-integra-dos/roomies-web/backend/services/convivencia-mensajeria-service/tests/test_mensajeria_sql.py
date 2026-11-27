"""Regresiones del repositorio sobre PostgreSQL real, sin puertos simulados.

Usa únicamente la base efímera administrada por tests/run_isolated.py.
No acredita el recorrido integrado de autenticación, Gateway ni expulsiones.
"""
from datetime import datetime, timedelta, timezone
import os
from uuid import uuid4

import psycopg
import pytest

from app.models import ServiceError

pytestmark = pytest.mark.usefixtures("empty_database")


@pytest.fixture
def chat(empty_database, migrated_database):
    entered = datetime(2026, 11, 25, tzinfo=timezone.utc)
    with psycopg.connect(migrated_database) as connection:
        rental = connection.execute("""INSERT INTO convivencia_mensajeria.arriendo
            (id_publicacion,cupos_totales,version_capacidad) VALUES(7,2,1)
            RETURNING id_arriendo""").fetchone()[0]
        conversation = connection.execute("""INSERT INTO convivencia_mensajeria.conversacion
            (id_arriendo) VALUES(%s) RETURNING id_conversacion""", (rental,)).fetchone()[0]
        for user in (2, 3):
            operation = uuid4()
            connection.execute("INSERT INTO convivencia_mensajeria.incorporacion(id_operacion,payload) VALUES(%s,'{}')", (operation,))
            connection.execute("""INSERT INTO convivencia_mensajeria.pertenencia
                (id_arriendo,id_usuario,id_postulacion,id_operacion,creada_en)
                VALUES(%s,%s,%s,%s,%s)""", (rental, user, user, operation, entered))
    return conversation, entered


def test_historial_cronologico_con_empates_ingreso_y_cursor(repository, chat, migrated_database):
    conversation, entered = chat
    expected = []
    with psycopg.connect(migrated_database) as connection:
        # Fechas deliberadamente distintas al orden de asignación del identity.
        for offset in [-1, *reversed(range(55))]:
            timestamp = entered + timedelta(seconds=offset // 2)
            message = connection.execute("""INSERT INTO convivencia_mensajeria.mensaje
                (id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente,fecha_envio)
                VALUES(%s,2,'Cuenta SQL','Prueba SQL',%s,%s) RETURNING id_mensaje""",
                (conversation, uuid4(), timestamp)).fetchone()[0]
            if offset >= 0:
                expected.append((timestamp, message))
            else:
                pre_entry = message
    pages, before = [], None
    while True:
        page, before = repository.messages(conversation, 2, before, 20)
        pages.insert(0, [row["id_mensaje"] for row in page])
        if before is None:
            break
    actual = [message for page in pages for message in page]
    assert len(pages) == 3
    assert actual == [message for _, message in sorted(expected)]
    assert len(set(actual)) == 55
    print("SQL historial: 55 mensajes autorizados, tres páginas sin duplicados; cursor final NULL; preingreso excluido.")
    with pytest.raises(ServiceError) as error:
        repository.messages(conversation, 2, pre_entry, 20)
    assert error.value.status == 422


def test_reintento_y_conflicto_sin_filas_duplicadas(repository, chat):
    conversation, _ = chat
    client = uuid4()
    first = repository.send_message(conversation, 2, "Cuenta SQL", "Persistido", client)
    retry = repository.send_message(conversation, 2, "Cuenta SQL", "Persistido", client)
    assert first["id_mensaje"] == retry["id_mensaje"]
    with pytest.raises(ServiceError) as error:
        repository.send_message(conversation, 2, "Cuenta SQL", "Otro contenido", client)
    assert error.value.status == 409
    with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
        count = connection.execute("""SELECT count(*) FROM convivencia_mensajeria.mensaje
            WHERE id_conversacion=%s AND id_remitente=2 AND id_cliente=%s""",
            (conversation, client)).fetchone()[0]
        assert count == 1
        print("SQL idempotencia: COUNT(*) por conversación/emisor/id_cliente =", count)


def test_repositorio_revoca_lectura_envio_y_replay(repository, chat, migrated_database):
    conversation, _ = chat
    client = uuid4()
    repository.send_message(conversation, 3, "Cuenta SQL", "Antes del retiro", client)
    with psycopg.connect(migrated_database) as connection:
        connection.execute("UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_usuario=3")
    for user in (3, 99):
        for operation in (
            lambda: repository.messages(conversation, user, None, 20),
            lambda: repository.send_message(conversation, user, "Cuenta SQL", "Antes del retiro", client),
        ):
            with pytest.raises(ServiceError) as error:
                operation()
            assert error.value.status == 403
            assert error.value.body["codigo"] == "sin_permiso"
