FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY backend/auth_service/requirements-docker.txt /tmp/requirements-docker.txt
RUN pip install --no-cache-dir --requirement /tmp/requirements-docker.txt \
    && rm /tmp/requirements-docker.txt \
    && groupadd --system --gid 10001 roomies \
    && useradd --system --uid 10001 --gid roomies --home-dir /nonexistent \
       --shell /usr/sbin/nologin roomies

# Mantener backend.auth_service como import del paquete raíz del repositorio.
COPY backend/auth_service/ /app/backend/auth_service/

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/health', timeout=2).read()" || exit 1

CMD ["python", "-m", "uvicorn", "backend.auth_service.app:app", "--host", "0.0.0.0", "--port", "8000"]
