# Ejecutar Auth con Docker

## Requisitos previos

- Docker Desktop o Docker Engine con el comando `docker` disponible.
- Ejecutar los comandos desde la raíz del repositorio.
- Una configuración local de prueba para las variables funcionales de Auth. Guárdala fuera del repositorio y usa servicios PostgreSQL y SMTP de prueba; no uses credenciales ni bases de datos de producción.

## Construir la imagen

Desde la raíz del repositorio:

```powershell
docker build -f backend/auth_service/Dockerfile -t roomies-auth:scrum-77 .
```

## Ejecutar localmente

Indica a Docker el archivo local de configuración de prueba, que no debe agregarse al repositorio:

```powershell
$authEnvFile = "C:\ruta\local\auth-test.env"
docker run --detach --name roomies-auth-local `
  --env-file $authEnvFile `
  -p 127.0.0.1:18001:8000 `
  roomies-auth:scrum-77
```

El servicio escucha en el puerto `8000` del contenedor y se publica solo en `127.0.0.1:18001` del equipo local.

## Comprobar salud, estado y logs

Consulta el endpoint desde PowerShell:

```powershell
$health = Invoke-WebRequest -Uri "http://127.0.0.1:18001/health" -Method Get
$health.StatusCode
$health.Content
```

La respuesta esperada es HTTP `200` con `{"status":"ok"}`. Este endpoint comprueba que el proceso HTTP responde; **no comprueba la disponibilidad de PostgreSQL ni SMTP**.

Consulta el estado y la salud registrada por Docker:

```powershell
docker ps --filter "name=roomies-auth-local"
docker inspect --format "{{.State.Status}} / {{.State.Health.Status}}" roomies-auth-local
```

Consulta los logs:

```powershell
docker logs roomies-auth-local
```

## Variables de entorno de Auth

Para habilitar las operaciones funcionales, Auth necesita:

- `AUTH_JWT_ENABLED`
- `JWT_SECRET_KEY`
- `AUTH_CODE_SECRET`
- `DATABASE_URL`

Para registro y reenvío de códigos por correo también necesita:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`

La configuración SMTP debe permitir STARTTLS y autenticación. Las variables opcionales de comportamiento son `JWT_ALGORITHM`, `JWT_EXPIRATION_MINUTES` y `CODIGO_EXPIRACION_MINUTOS`.

`AUTH_JWT_ENABLED` debe habilitar Auth para estas rutas. `JWT_SECRET_KEY` y `AUTH_CODE_SECRET` deben ser distintos y cumplir el mínimo de longitud que valida el servicio. `JWT_ALGORITHM` admite HS256; las duraciones tienen límites validados por la aplicación. `SMTP_PORT` usa 587 si no se especifica.

`/health` puede responder correctamente aunque PostgreSQL y SMTP no estén configurados. Registro, verificación, reenvío, login y logout requieren que la aplicación tenga sus dependencias funcionales disponibles; registro y reenvío además dependen del envío SMTP. Esta guía no afirma que Auth esté completamente integrado con PostgreSQL ni con Match.
