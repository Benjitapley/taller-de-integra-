import os
from pathlib import Path
import pytest
import psycopg
from psycopg.rows import dict_row


@pytest.fixture(scope="session")
def database():
    url=os.environ.get("PUBLICATIONS_TEST_ADMIN_DSN")
    if not url:
        pytest.skip("Ejecutar tests/run_isolated.py para PostgreSQL efímero.")
    service=Path(__file__).resolve().parents[1]
    with psycopg.connect(url,autocommit=True) as connection:
        connection.execute((service.parents[1]/"local_stack/bootstrap.sql").read_text(encoding="utf-8"))
        for path in sorted((service/"migrations").glob("*.sql")):
            connection.execute(path.read_text(encoding="utf-8"))
    yield


@pytest.fixture
def admin_connection(database):
    with psycopg.connect(os.environ["PUBLICATIONS_TEST_ADMIN_DSN"],autocommit=True,row_factory=dict_row) as connection:
        connection.execute("TRUNCATE listado_applications.publicacion RESTART IDENTITY CASCADE")
        connection.execute("TRUNCATE listado_applications.publication_image_operation,listado_applications.publication_image_cleanup,listado_applications.outbox")
        yield connection


@pytest.fixture
def repository(admin_connection):
    from app.infrastructure.repository import PostgresPublications
    return PostgresPublications()
