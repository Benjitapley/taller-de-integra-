from sqlalchemy.orm import sessionmaker
import os
from sqlalchemy import create_engine
from functools import lru_cache


@lru_cache
def session_factory():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Falta DATABASE_URL del servidor.")
    # El backend usa psycopg 3; SQLAlchemy no debe seleccionar psycopg2 implícitamente.
    url = url.replace("postgres://", "postgresql+psycopg://", 1).replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_engine(url)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = session_factory()()
    try:
        yield db
    finally:
        db.close()
