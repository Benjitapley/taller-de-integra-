import os
import psycopg


def conectar():
    """Solo se conecta cuando una operación habilitada lo requiere."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Falta DATABASE_URL del servidor.")
    return psycopg.connect(url, connect_timeout=10)
