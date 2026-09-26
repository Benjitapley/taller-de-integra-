from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


SQLALCHEMY_DATABASE_URL = "postgresql://postgres:Hcupo2223xd@db.erefnpvdjondjpcyjrpb.supabase.co:5432/postgres"

# Motor de conexión a la base de datos
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Creador de sesiones para ejecutar las consultas
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()