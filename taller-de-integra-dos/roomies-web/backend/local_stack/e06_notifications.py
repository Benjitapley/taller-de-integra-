"""E06: Auth real sobre el clúster efímero creado por el runner de Listado.

Se ejecuta en otro proceso para no mezclar los paquetes `app` de los servicios.
No admite bases remotas ni utiliza dotenv.
"""
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg

root = Path(__file__).resolve().parents[2]
dsn = os.environ["PUBLICATIONS_TEST_ADMIN_DSN"]
address = urlsplit(dsn)
if address.hostname != "127.0.0.1" or address.path != "/roomies_sprint2_disposable":
    raise SystemExit("Solo se admite el laboratorio efímero de loopback.")
os.environ["AUTH_USERS_DATABASE_URL"] = f"postgresql://sql_auth_users@127.0.0.1:{address.port}/roomies_sprint2_disposable"
os.environ["AUTH_NOTIFICATIONS_CURSOR_SECRET"] = "e06-disposable-cursor-key-" + "x" * 32
sys.path[:0] = [str(root / "backend/services/auth-users-service"), str(root)]
from app.infrastructure.persistence.local_users import PostgresUsers
from app.application.notifications import notification_page
from backend.service_runtime.contracts import RuleViolation

repository = PostgresUsers()
first = repository.ensure(uuid4(), "E06 ficticio", "2000-01-01").id_usuario
other = repository.ensure(uuid4(), "E06 otra cuenta", "2000-01-01").id_usuario
with psycopg.connect(dsn) as connection:
    connection.execute("""INSERT INTO auth_users.notificacion(id_usuario,event_key,tipo,referencia_id,estado,creado_en)
        SELECT %s,'e06:' || %s || ':' || n,'Postulacion_Resultado',n,'Aceptada','2026-11-26T12:00:00Z'
        FROM generate_series(1,53) n""", (first, str(uuid4())))
    expected = [row[0] for row in connection.execute("SELECT id FROM auth_users.notificacion WHERE id_usuario=%s ORDER BY creado_en DESC,id DESC", (first,))]
ids, cursor, pages, first_cursor = [], None, 0, None
while True:
    page = notification_page(repository, first, 20, cursor)
    ids.extend(row["id_notificacion"] for row in page["items"])
    cursor = page["siguiente_cursor"]
    first_cursor = first_cursor or cursor
    pages += 1
    if cursor is None:
        break
assert pages == 3 and ids == expected and len(set(ids)) == 53
assert notification_page(repository, other, 20, None)["items"] == []
for user, invalid in ((other, first_cursor), (first, "invalid")):
    try:
        notification_page(repository, user, 20, invalid)
        raise AssertionError("Se aceptó un cursor inválido o de otra cuenta")
    except RuleViolation as error:
        assert error.status == 422
with psycopg.connect(dsn) as connection:
    connection.execute("DELETE FROM auth_users.notificacion WHERE id_usuario IN (%s,%s)", (first, other))
    connection.execute("DELETE FROM auth_users.usuario WHERE id_usuario IN (%s,%s)", (first, other))
print("PASS E06 notificaciones: SQL real, 53 filas, 3 páginas, fechas empatadas, fin y otra cuenta.")
