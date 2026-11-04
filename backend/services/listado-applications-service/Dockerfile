FROM python:3.13.18-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/services/listado-applications-service/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt \
    && groupadd --gid 10001 roomies && useradd --uid 10001 --gid 10001 --no-create-home roomies \
    && mkdir /images && chown 10001:10001 /images
COPY backend/__init__.py ./backend/__init__.py
COPY backend/service_runtime/ ./backend/service_runtime/
COPY backend/services/listado-applications-service/app/ ./app/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/health', timeout=2)"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
