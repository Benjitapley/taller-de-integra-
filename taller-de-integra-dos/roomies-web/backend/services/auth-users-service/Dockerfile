FROM python:3.13.18-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

# Copy only runtime code and pinned runtime dependencies from the repository root.
COPY backend/services/auth-users-service/requirements.txt /tmp/requirements.txt
RUN python -m pip install --no-cache-dir --requirement /tmp/requirements.txt \
    && rm /tmp/requirements.txt \
    && groupadd --system --gid 10001 roomies \
    && useradd --system --uid 10001 --gid 10001 --no-create-home \
       --shell /usr/sbin/nologin roomies \
    && mkdir /images && chown 10001:10001 /images

COPY --chown=10001:10001 backend/services/auth-users-service/app/ ./app/
COPY backend/__init__.py ./backend/__init__.py
COPY backend/service_runtime/ ./backend/service_runtime/

USER 10001:10001

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import os; from urllib.request import urlopen; urlopen('http://127.0.0.1:' + (os.environ.get('PORT') or '8000') + '/health', timeout=2).read()" || exit 1

CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]
