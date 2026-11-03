# Docker — Auth/Users

Este documento cubre la imagen del nuevo servicio en `backend/services/auth-users-service`.
Los comandos se ejecutan desde la raíz del repositorio; ese es el contexto necesario
para que Docker copie `app/` y `requirements.txt`. El Dockerfile copia únicamente
esos elementos de runtime: no incorpora pruebas, migraciones, documentación, bases
locales ni archivos de configuración del host.

## Requisitos

- Docker Desktop o Docker Engine disponible.
- PowerShell 7 abierto en la raíz del repositorio.
- Para comprobar solo el arranque, `/health` y `/docs`, no se requieren PostgreSQL,
  Supabase ni variables de entorno.

## Construir

```powershell
docker build -f backend/services/auth-users-service/Dockerfile `
  -t roomies-auth-users:scrum-77 .
```

El punto final es importante: indica que la raíz del repositorio es el contexto.
La imagen usa `python:3.13.18-slim-bookworm` y las versiones fijadas en
`requirements.txt`:

- `fastapi==0.141.1`
- `uvicorn==0.53.0`
- `PyJWT[crypto]==2.15.0`
- `cryptography==50.0.1`
- `psycopg[binary]==3.3.6`

La imagen ejecuta como usuario no privilegiado. No se pasan credenciales durante
el build ni se guardan dentro de la imagen.

## Probar localmente

Usa un nombre y puerto libres; este ejemplo publica solo en loopback y evita el
puerto 18007 actualmente usado por el servicio local:

```powershell
$containerName = 'roomies-auth-users-scrum-77-check'
docker run --detach --name $containerName `
  --publish 127.0.0.1:18008:8000 `
  roomies-auth-users:scrum-77
```

Comprobar salud y documentación HTTP:

```powershell
$health = Invoke-WebRequest -Uri 'http://127.0.0.1:18008/health' -Method Get
$health.StatusCode
$health.Content

$docs = Invoke-WebRequest -Uri 'http://127.0.0.1:18008/docs' -Method Get
$docs.StatusCode
```

La respuesta de salud esperada es HTTP `200` con `{"status":"ok"}`. El healthcheck
Docker usa Python `urllib` de la biblioteca estándar y no necesita credenciales.
Solo comprueba que el proceso HTTP responda; no valida PostgreSQL ni Supabase.

Probar una ruta privada sin configuración de identidad debe dar HTTP `503` con un
mensaje genérico de verificación no configurada. No se necesita enviar un token:

```powershell
$profile = Invoke-WebRequest -Uri 'http://127.0.0.1:18008/usuarios/me' `
  -Method Get -SkipHttpErrorCheck
$profile.StatusCode
$profile.Content
```

Consultar estado, estado del healthcheck y logs:

```powershell
docker inspect --format '{{.State.Status}} / {{.State.Health.Status}}' $containerName
docker logs $containerName
```

Al terminar una prueba creada por quien ejecuta este procedimiento, se puede
detener y retirar ese contenedor de prueba:

```powershell
docker stop $containerName
docker rm $containerName
```

Estos comandos de limpieza son documentación para una ejecución futura; no se
han ejecutado durante esta etapa.

## Puerto

Uvicorn escucha en `0.0.0.0` y usa `PORT` cuando está definida y no vacía. Si
`PORT` no está definida o está vacía, utiliza `8000`. El healthcheck aplica la
misma regla. Para Render, el puerto interno lo proporciona el entorno mediante
`PORT`; localmente el ejemplo publica `127.0.0.1:18008:8000`.

## Configuración funcional

El servicio no carga archivos `.env` automáticamente. `/health` y `/docs` pueden
probarse sin configuración externa. Para las operaciones de perfil, inyecta la
configuración en tiempo de ejecución desde un gestor seguro, nunca con `ARG`,
`ENV` en el Dockerfile ni durante `docker build`.

Variables de identidad Supabase:

- Obligatorias: `SUPABASE_URL`, `SUPABASE_JWT_AUDIENCE`, `SUPABASE_JWT_ALGORITHMS`.
- Opcionales: `SUPABASE_JWT_ISSUER`, `SUPABASE_JWKS_URL`,
  `SUPABASE_JWKS_TIMEOUT_SECONDS`, `SUPABASE_JWKS_CACHE_SECONDS`.

Variables PostgreSQL:

- Desarrollo local: `AUTH_USERS_DATABASE_URL`, opcionalmente
  `AUTH_USERS_DATABASE_ENVIRONMENT` y `AUTH_USERS_DB_CONNECT_TIMEOUT_SECONDS`.
  La política `development` solo admite los destinos locales definidos por el
  servicio y la base `roomies_auth_users_dev`.
- Staging: requiere `AUTH_USERS_DATABASE_URL`,
  `AUTH_USERS_DATABASE_ENVIRONMENT=staging` y `AUTH_USERS_STAGING_ALLOWED_HOSTS`.
  El destino autorizado debe usar TLS. La configuración concreta de staging debe
  venir del equipo y del gestor de secretos del entorno.

El contenedor no envía correo ni implementa registro, confirmación o gestión de
sesiones. Supabase Auth es el proveedor de identidad previsto en la arquitectura,
pero la validación de su integración real sigue pendiente. Las pruebas locales
criptográficas y del fallo seguro no equivalen a validar la integración en un
entorno desplegado. No se incluyen claves privadas ni secretos de Supabase en la
imagen.

## Render — configuración prevista

Para una configuración futura de Render, el repositorio completo debe ser el
contexto de construcción y la ruta del Dockerfile es
`backend/services/auth-users-service/Dockerfile`. Configura las variables de
staging mediante el gestor de secretos del servicio y establece el health check
HTTP en `/health`. La base de datos local de desarrollo no debe conectarse desde
Render.

Esto documenta la configuración prevista. **No acredita una construcción en
Render ni que el servicio se haya desplegado allí.**
