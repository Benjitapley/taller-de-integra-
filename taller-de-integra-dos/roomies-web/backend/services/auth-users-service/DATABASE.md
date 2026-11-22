# PostgreSQL para Auth/Users

La aplicación no carga archivos `.env` y no usa `DATABASE_URL` como respaldo.
Las migraciones no se ejecutan al importar FastAPI ni al iniciar Uvicorn. Este
documento describe destinos locales desechables; no acredita una conexión o
migración realizada.

## Políticas de conexión

### Desarrollo local

`AUTH_USERS_DATABASE_ENVIRONMENT` toma `development` por defecto. En ese modo,
`AUTH_USERS_DATABASE_URL` debe usar el usuario `sql_auth_users`, la base
`roomies_auth_users_dev` y uno de estos destinos locales:

| Host | Puerto |
|---|---:|
| `127.0.0.1` | `15432` |
| `host.docker.internal` | `15432` |
| Alias Docker local `auth-users-db` | `5432` |

Las pruebas de integración son más estrictas: ambas URLs deben apuntar
exactamente a `127.0.0.1:15432/roomies_auth_users_test`. `AUTH_USERS_DB_CONNECT_TIMEOUT_SECONDS`
es opcional, por defecto `3`, y acepta de `1` a `15` segundos.

### Staging

Staging es una política distinta y debe seleccionarse explícitamente mediante
`AUTH_USERS_DATABASE_ENVIRONMENT=staging`. Requiere `AUTH_USERS_DATABASE_URL`,
`AUTH_USERS_STAGING_ALLOWED_HOSTS` y un parámetro TLS `sslmode` permitido. El host
se valida contra esa lista; el puerto y nombre de base no quedan fijados en el
código. Esto permite configurar el PostgreSQL de staging que el equipo autorice
sin habilitar destinos remotos desde la configuración local por defecto. Los
secretos deben cargarse desde el gestor de secretos del entorno; esta ruta no se
ha configurado ni desplegado en Render.

## Preparar PostgreSQL local en Docker Desktop

Ejecuta los siguientes pasos desde PowerShell, desde la raíz del repositorio.
No reutilices un contenedor o volumen cuyo origen no hayas confirmado.

### 1. Comprobar nombres, imagen y puerto

```powershell
$containerName = 'roomies-auth-users-pg-dev'
$volumeName = 'roomies-auth-users-pg-dev-data'

docker image inspect postgres:16 --format '{{.Id}}'
docker ps -a --filter "name=^/$containerName$" --format '{{.Names}} {{.Status}}'
docker volume ls --filter "name=^$volumeName$"
Test-NetConnection -ComputerName 127.0.0.1 -Port 15432
```

Si el contenedor o volumen ya existe, detente y verifica que pertenezca a este
entorno antes de continuar. No borres ni reutilices datos desconocidos.

### 2. Crear el secreto inicial fuera del repositorio

`POSTGRES_PASSWORD_FILE` evita poner la contraseña en la línea de comandos o en
el entorno visible del contenedor. Genera el archivo bajo `%LOCALAPPDATA%`, con
ACL limitada a tu usuario y `SYSTEM`; no lo guardes en el repositorio. Por
ejemplo, tras crear y proteger un directorio dedicado:

```powershell
$secretDirectory = Join-Path $env:LOCALAPPDATA 'Roomies\AuthUsers'
if (Test-Path $secretDirectory) {
  throw 'El directorio de secretos ya existe; revísalo y elige una ruta nueva.'
}
New-Item -ItemType Directory -Path $secretDirectory | Out-Null
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $secretDirectory /inheritance:r /grant:r `
  "$($account):(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo restringir el ACL del directorio.' }

$postgresPasswordFile = Join-Path $secretDirectory 'postgres-init-password'
if (Test-Path $postgresPasswordFile) {
  throw 'El archivo de secreto ya existe; no se sobrescribe.'
}
$randomBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$initialPassword = $null
try {
  $rng.GetBytes($randomBytes)
  $initialPassword = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  [System.IO.File]::WriteAllText($postgresPasswordFile, $initialPassword, [System.Text.Encoding]::ASCII)
} finally {
  [Array]::Clear($randomBytes, 0, $randomBytes.Length)
  $rng.Dispose()
  Remove-Variable initialPassword, randomBytes, rng -ErrorAction SilentlyContinue
}
```

No imprimas el archivo ni lo agregues a Git. Conserva su ubicación para
administrar la instancia.

### 3. Crear el contenedor y el volumen persistente

El puerto se publica solo en loopback. El volumen nombrado conserva los datos
si el contenedor se detiene o se reemplaza.

```powershell
docker run --detach `
  --name $containerName `
  --publish 127.0.0.1:15432:5432 `
  --mount "type=volume,source=$volumeName,target=/var/lib/postgresql/data" `
  --mount "type=bind,source=$postgresPasswordFile,target=/run/secrets/postgres_password,readonly" `
  --env POSTGRES_USER=postgres `
  --env POSTGRES_DB=postgres `
  --env POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password `
  --env POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 `
  --health-cmd "pg_isready -U postgres -d postgres" `
  --health-interval 5s `
  --health-timeout 3s `
  --health-retries 10 `
  --health-start-period 10s `
  postgres:16
```

Comprueba salud y puerto sin inspeccionar variables del contenedor:

```powershell
docker inspect --format '{{.State.Status}} {{.State.Health.Status}}' $containerName
docker port $containerName 5432/tcp
docker exec --user postgres $containerName pg_isready -U postgres -d postgres
```

El resultado del puerto publicado debe ser `127.0.0.1:15432`. No uses `docker
rm -v` ni elimines el volumen para detener este entorno.

### 4. Crear los roles y la base de desarrollo

Abre `psql` por el socket local del contenedor. No incluyas contraseñas en el
comando:

```powershell
docker exec --interactive --tty --user postgres $containerName `
  psql -X -U postgres -d postgres
```

En `psql`, crea un rol migrador separado y el login de runtime. Ambos deben ser
sin privilegios globales ni membresías; el migrador será dueño de la base y el
runtime solo recibirá los grants de las migraciones:

```sql
CREATE ROLE roomies_auth_users_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE sql_auth_users LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE DATABASE roomies_auth_users_dev OWNER roomies_auth_users_migrator;
REVOKE ALL ON DATABASE roomies_auth_users_dev FROM PUBLIC;
GRANT CONNECT ON DATABASE roomies_auth_users_dev TO roomies_auth_users_migrator, sql_auth_users;
```

En el mismo prompt de `psql`, asigna contraseñas usando `\password
roomies_auth_users_migrator` y `\password sql_auth_users`; `psql` las pide sin
mostrarlas. Guárdalas en un gestor seguro. Conéctate luego a
`roomies_auth_users_dev` y, en **esta base nueva solamente**, ejecuta:

```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

Antes de migrar, confirma con `SELECT current_database(), current_user;` que el
destino sea `roomies_auth_users_dev`, que el usuario sea el migrador y que
`SELECT to_regnamespace('auth_users');` devuelva nulo. Si algo no coincide,
detente. La migración también valida que `sql_auth_users` sea un login aislado,
sin herencia, privilegios elevados ni membresías en ninguna dirección.

### 5. Aplicar migraciones atómicamente

No agregues `BEGIN`/`COMMIT` a los archivos: la transacción la controla `psql`.
Combina los dos archivos en el orden indicado y usa `--single-transaction` junto
con `ON_ERROR_STOP=1`. Así cualquier fallo revierte el lote completo.

```powershell
$migrationDirectory = Join-Path (Get-Location) 'backend/services/auth-users-service/migrations'
$upSql = (Get-Content (Join-Path $migrationDirectory '001_auth_users_schema.up.sql') -Raw) +
         [Environment]::NewLine +
         (Get-Content (Join-Path $migrationDirectory '002_auth_users_runtime_grants.up.sql') -Raw)
$upSql | docker exec --interactive --user postgres $containerName `
  psql -X --single-transaction -v ON_ERROR_STOP=1 `
    -U roomies_auth_users_migrator -d roomies_auth_users_dev -f -
if ($LASTEXITCODE -ne 0) { throw 'Falló el lote de migración; revisa el destino y el error de psql.' }
Remove-Variable upSql
```

Verifica las columnas en `information_schema.columns` y los permisos con
`has_schema_privilege` y `has_table_privilege`. Runtime debe tener `USAGE` en
`auth_users`, `SELECT` en `auth_users.usuario`, `INSERT` solo en columnas de
inicialización, `UPDATE` solo en campos editables y `USAGE` en la secuencia de
identidad. No debe tener `DELETE`, actualización de identificadores o campos
protegidos, acceso a `public` ni privilegios de creación.

### 6. Configurar la conexión de Auth sin mostrarla

Solicita la contraseña de runtime de forma oculta y mantén la URL solo en el
proceso actual de PowerShell. No consultes ni imprimas la variable:

```powershell
function Set-RoomiesPostgresUrl {
  param([string]$VariableName, [string]$UserName, [string]$DatabaseName)
  $secure = Read-Host "Contraseña para $UserName" -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $escaped = [Uri]::EscapeDataString($plain)
    $url = "postgresql://${UserName}:${escaped}@127.0.0.1:15432/${DatabaseName}"
    [Environment]::SetEnvironmentVariable($VariableName, $url, 'Process')
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Variable plain, escaped, url, secure -ErrorAction SilentlyContinue
  }
}

$env:AUTH_USERS_DATABASE_ENVIRONMENT = 'development'
Set-RoomiesPostgresUrl 'AUTH_USERS_DATABASE_URL' 'sql_auth_users' 'roomies_auth_users_dev'
```

Para Auth ejecutado dentro de Docker Desktop, usa el destino local permitido
`host.docker.internal:15432` o un alias de red Docker configurado como
`auth-users-db:5432`. No cambies la política de staging para resolver una
conexión local.

Al terminar, elimina las variables de esta sesión:

```powershell
[Environment]::SetEnvironmentVariable('AUTH_USERS_DATABASE_URL', $null, 'Process')
[Environment]::SetEnvironmentVariable('AUTH_USERS_DATABASE_ENVIRONMENT', $null, 'Process')
```

## Base de pruebas PostgreSQL

`roomies_auth_users_test` es otra base local dentro de un clúster de pruebas. No
es la base persistente de desarrollo. Se crea separadamente, con el rol
migrador como dueño, `sql_auth_users` como runtime, conectividad limitada a esos
roles y sin un esquema previo `auth_users`. Revoca antes `PUBLIC` del esquema
`public` de esa base; el fixture solo verifica que runtime no tenga `USAGE` ni
`CREATE` ahí. La prueba exige exactamente
`127.0.0.1:15432/roomies_auth_users_test` para las dos URLs y rechaza si difieren
host, puerto, base o destino; la URL runtime debe autenticar como
`sql_auth_users`.

La prueba solo se habilita con `AUTH_USERS_RUN_POSTGRES_INTEGRATION=1`,
`AUTH_USERS_TEST_ADMIN_DATABASE_URL` y `AUTH_USERS_TEST_DATABASE_URL`. Solicita
los secretos con el helper anterior para usuario `roomies_auth_users_migrator`
y `sql_auth_users`, usando la base de pruebas. La conexión migradora debe ser
superusuario o dueña de esa base. Al crear la base dedicada, usa el migrador
como propietario, limita `CONNECT` a ambos roles y revoca el esquema público,
igual que en desarrollo:

```sql
CREATE DATABASE roomies_auth_users_test OWNER roomies_auth_users_migrator;
REVOKE ALL ON DATABASE roomies_auth_users_test FROM PUBLIC;
GRANT CONNECT ON DATABASE roomies_auth_users_test TO roomies_auth_users_migrator, sql_auth_users;
```

Luego conecta a `roomies_auth_users_test` y ejecuta `REVOKE ALL ON SCHEMA public
FROM PUBLIC;`. No crees `auth_users` manualmente: el fixture lo crea y lo retira.
Ejecuta únicamente:

```powershell
$env:AUTH_USERS_RUN_POSTGRES_INTEGRATION = '1'
Set-RoomiesPostgresUrl 'AUTH_USERS_TEST_ADMIN_DATABASE_URL' 'roomies_auth_users_migrator' 'roomies_auth_users_test'
Set-RoomiesPostgresUrl 'AUTH_USERS_TEST_DATABASE_URL' 'sql_auth_users' 'roomies_auth_users_test'
.\.venv\Scripts\python.exe -m pytest 'backend/services/auth-users-service/tests/test_postgres_integration.py' -q
```

El fixture preflight rechaza esquemas existentes y privilegios de runtime sobre
`public`; aplica ambas migraciones y crea el esquema auxiliar dentro de una
transacción. Luego prueba persistencia, unicidad, idempotencia concurrente,
aislamiento entre usuarios y permisos. Al finalizar, retira los esquemas y sus
datos mediante las migraciones `down`. No borra la base, roles, contenedor ni
volumen. Asegúrate de que la URL administradora y la runtime apunten al mismo
servidor, puerto y base antes de habilitar la prueba.

Después, deshabilita explícitamente la opción y limpia URLs del proceso:

```powershell
Remove-Item Env:AUTH_USERS_RUN_POSTGRES_INTEGRATION -ErrorAction SilentlyContinue
Remove-Item Env:AUTH_USERS_TEST_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:AUTH_USERS_TEST_DATABASE_URL -ErrorAction SilentlyContinue
```

## Reversión

La reversión también se ejecuta en una única transacción y en orden inverso:

```powershell
$downSql = (Get-Content (Join-Path $migrationDirectory '002_auth_users_runtime_grants.down.sql') -Raw) +
           [Environment]::NewLine +
           (Get-Content (Join-Path $migrationDirectory '001_auth_users_schema.down.sql') -Raw)
$downSql | docker exec --interactive --user postgres $containerName `
  psql -X --single-transaction -v ON_ERROR_STOP=1 `
    -U roomies_auth_users_migrator -d roomies_auth_users_dev -f -
if ($LASTEXITCODE -ne 0) { throw 'Falló la reversión; revisa el destino y el error de psql.' }
Remove-Variable downSql
```

`002 down` retira privilegios. `001 down` elimina `auth_users.usuario`, incluidos
sus datos, y luego el esquema; no usa `CASCADE`, por lo que falla si hay otros
objetos. Ejecuta la reversión solo en la base local desechable correcta y con
respaldo si sus datos importan.
