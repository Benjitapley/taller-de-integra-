# API Gateway independiente — SCRUM-83, fase aislada

FastAPI sin imports del backend central ni dependencias de PostgreSQL, Supabase
o JWT. Python verificado: 3.13.1. No modifica consumidores existentes.

## Preparación y ejecución en PowerShell

Desde la raíz del worktree:

```powershell
Set-Location backend/api-gateway
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/requirements.txt
.\.venv\Scripts\python.exe -I -B tests/run_isolated.py
.\.venv\Scripts\python.exe -I -B tests/run_loopback.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log --no-proxy-headers
```

No hace falta activar el entorno. Si ensurepip falla pero deja un intérprete local
funcional, usar el pip base para instalar exclusivamente dentro de ese entorno:

```powershell
python -m pip --python .venv/Scripts/python.exe install -r tests/requirements.txt
```

La instalación descarga paquetes del registro. La suite en memoria no arranca
Uvicorn; la integración loopback levanta dos procesos Uvicorn temporales con
upstream ficticio. Ninguna usa servicios reales o red externa.
No ejecutar pytest directamente como sustituto
del runner. En este equipo el sandbox bloqueó el socket interno de asyncio en
Windows; la suite terminó fuera del sandbox manteniendo sus bloqueos de red.

Sin upstream, `/health` responde `200 {"status":"ok"}` y `/usuarios/me` responde
503. Health indica vida del proceso, no disponibilidad de Auth/Users.

## Configuración

No se carga `.env` automáticamente. `.env.example` es una plantilla. Para una
futura prueba con un upstream local ficticio, se podría exportar:

```powershell
$env:AUTH_USERS_UPSTREAM_URL = 'http://127.0.0.1:9000'
```

No usar ese ejemplo contra servicios reales en esta fase.

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `AUTH_USERS_UPSTREAM_URL` | Ausente | Origen HTTP/HTTPS fijo, sin credenciales, prefijo, query ni fragmento. |
| `GATEWAY_CONNECT_TIMEOUT` | 3 | Segundos para conexión. |
| `GATEWAY_READ_TIMEOUT` | 10 | Segundos de espera por lectura. |
| `GATEWAY_WRITE_TIMEOUT` | 10 | Segundos de espera por escritura. |
| `GATEWAY_POOL_TIMEOUT` | 3 | Segundos para obtener conexión del pool. |
| `GATEWAY_CLIENT_BODY_TIMEOUT` | 5 | Segundos máximos para recibir todo el cuerpo entrante. |
| `GATEWAY_TOTAL_TIMEOUT` | 15 | Segundos compartidos por recepción y operación upstream completa. |
| `GATEWAY_MAX_REQUEST_BYTES` | 1048576 | Máximo del cuerpo entrante: 1 MiB. |
| `GATEWAY_MAX_RESPONSE_BYTES` | 2097152 | Máximo de respuesta raw del upstream: 2 MiB. |

Timeouts finitos en `(0, 120]`. Configuración inválida impide el arranque con
mensaje genérico. HTTP permite simulación local; TLS de despliegue queda pendiente.
Límites de bytes: enteros en `(0, 16777216]` (máximo configurable 16 MiB).
FastAPI 0.162.0 y Starlette 1.10.0 están fijados y verificados en el entorno local;
el par anterior no admitía la versión corregida de Starlette.

## Contrato

- Solo GET `/health` y GET/PATCH `/usuarios/me`. Sin Swagger, rutas comodín,
  Listado ni redirecciones automáticas por slash. Alias codificados de la ruta
  privada se rechazan cuando llegan sin normalizar al ASGI server.
- Destino fijo; query, Host y cabeceras del cliente no lo seleccionan.
- Conserva método, query raw con duplicados, cuerpo en bytes y Content-Type.
  No parsea JSON ni valida perfiles.
- Reenvía Authorization sin reinterpretarlo. Sin token, también llama al servicio:
  Auth/Users decide identidad y permisos. No emite ni valida JWT.
- Conserva status, cuerpo, Content-Type y Content-Encoding, incluidos errores HTTP.
  Solicita `Accept-Encoding: identity`; si recibe compresión, preserva bytes raw.
- Solicitudes: Content-Encoding ausente o una sola cabecera `identity` (sin distinguir
  mayúsculas). Otras codificaciones, listas o duplicados se rechazan con 415 antes
  de leer/retransmitir el cuerpo. `identity` se puede reenviar.
- Allowlist de solicitud: Authorization, Content-Type, Content-Encoding, Accept, Accept-Language.
  HTTPX genera Host y framing. No transmite cookies ni X-Forwarded-* del cliente.
- Allowlist de respuesta: Content-Type, Content-Encoding, Content-Language,
  WWW-Authenticate, Retry-After. Excluye Set-Cookie, Server, Location, Refresh y
  cabeceras arbitrarias. Filtra hop-by-hop y las nombradas por Connection.
  No conserva casing, orden de cabeceras ni framing HTTP.
  Recalcula Content-Length con los bytes raw efectivos, excepto 204/304 donde no
  lo inventa. Si Connection intenta eliminar Content-Encoding, responde 502.
- Impone `Cache-Control: no-store` en la ruta privada, incluidos errores y 405.
- Un 3xx conserva status y cuerpo, sin Location/Refresh y sin seguir el destino.
  Es una excepción deliberada a la transparencia de cabeceras.
- Sin upstream: 503. Timeout HTTPX: 504. Fallo de conexión/TLS/protocolo: 502.
  Un 503 del servicio conserva su cuerpo original.
- Solicitud excesiva: 413. Respuesta upstream excesiva: 502 genérico y cierre del
  stream. La recepción se cuenta por fragmentos sin confiar en Content-Length;
  el exceso se detecta antes de agregar el fragmento al buffer.
- Recepción lenta: 408. Plazo total agotado durante upstream: 504. El plazo total
  comienza al entrar al proxy y comparte presupuesto entre ambos tramos; no se
  reinicia con cada fragmento. La limpieza puede añadir hasta 1 segundo para cerrar
  el upstream incluso tras cancelación. No hay reintentos de PATCH.
- Cliente compartido durante lifespan, cerrado al finalizar. Sin sesiones cookie
  compartidas, reintentos ni redirects. `trust_env=False` evita proxies heredados
  y configuración TLS por variables de entorno.

El proceso silencia la propagación de logs HTTPX/HTTPCore. Usar el comando sin
access log: URLs y query pueden contener datos privados. Reconfigurar logs del
transporte, servidor o proxy necesita revisión.

## Pruebas y límites

ASGITransport llama al Gateway y MockTransport representa Auth/Users. El runner
elimina entorno heredado salvo variables básicas de Windows, desactiva plugins
automáticos/caché pytest y bloquea DNS y sockets. Solo permite la construcción
interna de socketpair necesaria para asyncio en Windows. Comprueba que no se
importen backend central, psycopg, SQLAlchemy, Supabase ni JWT. Es una barrera
para esta suite, no un aislamiento contra código malicioso.

Se cubren Bearer ficticio, GET/PATCH, query codificada, cuerpos arbitrarios,
JSON/no JSON, 200/204/401/403/422/503, cabeceras, errores, redirects, compresión,
cierre de streams/cliente, reutilización y ausencia de cookies compartidas.
También límites exactos/exceso, fragmentación sin Content-Length, Host malformado,
408/413/415/502/504, plazos con fragmentos continuos y longitud/codificación.
La integración TCP comprueba estos controles con dos servidores locales y confirma
once llamadas upstream, sin duplicar PATCH y sin intentos externos detectados.
El modo `tests/run_loopback.py --fail-after-start` provoca salida 1 deliberada para
comprobar limpieza. Los detalles e historial están en el documento SCRUM-83.

Se retienen cuerpos completos pero acotados. Se usa un bytearray sin lista de
fragmentos; la conversión final a bytes crea una copia temporal y bytearray puede
reservar memoria adicional. También existen los chunks y buffers del servidor y
HTTPX: los límites no son un techo de RSS del proceso. El cuerpo de solicitud puede
coexistir con la respuesta; la concurrencia multiplica este presupuesto. No se
realizó perfilado de memoria. El plazo no incluye entrega final al consumidor ni
recepción inicial de cabeceras por Uvicorn. No hay rate limiting, límite global de
concurrencia, CORS, readiness remoto ni streaming al consumidor.

Auth/Users debe entregar cuerpos y cabeceras permitidas sanitizados: el Gateway
no elimina secretos ni direcciones internas incrustados en contenido arbitrario.
Un timeout PATCH no demuestra que la operación no se aplicó; consultar estado
antes de decidir reintentar en el consumidor.

Pendientes: contrato real de SCRUM-77, JWT/JWKS en ese servicio, migración móvil/web,
contrato Listado con Benjamín Cabrera, TLS, otras arquitecturas y validación de carga.
No se acredita integración con Render, Supabase, PostgreSQL o clientes reales.

## Docker local

Desde la raíz del worktree (el contexto de build debe ser **backend/api-gateway**):

```powershell
docker build --tag roomies-api-gateway --file backend/api-gateway/Dockerfile backend/api-gateway
backend/api-gateway/.venv/Scripts/python.exe -I -B backend/api-gateway/tests/run_docker.py
```

En este equipo Docker Desktop está instalado por usuario y fuera de PATH. Comandos
exactos utilizados, agregando su carpeta solo al entorno del proceso/terminal:

```powershell
$scrum83DockerDir = 'C:\Users\ALUMNO\AppData\Local\Programs\DockerDesktop\resources\bin'
$env:PATH = $scrum83DockerDir + ';' + $env:PATH
& "$scrum83DockerDir\docker.exe" build --tag roomies-api-gateway --file backend/api-gateway/Dockerfile backend/api-gateway
backend/api-gateway/.venv/Scripts/python.exe -I -B backend/api-gateway/tests/run_docker.py --docker "$scrum83DockerDir\docker.exe"
```

No construir desde la raíz usando `.` como contexto: la allowlist de `.dockerignore`
está diseñada para el directorio del Gateway. Solo incluye requirements, los cuatro
módulos app, el launcher y los archivos Docker. No incluye `.venv`, `.env`, secretos,
cachés, tests ni frontend/otros servicios. La imagen instala wheels fijadas y
ejecuta `pip check`. La base Python 3.13 slim-bookworm está fijada por digest.

El launcher Python valida PORT (1..65535; predeterminado 8000) y hace exec de Uvicorn
como PID 1, escuchando en 0.0.0.0, sin access log ni proxy headers. No usa shell para
expandir PORT. USER es 10001:10001, sin privilegios, y el código pertenece a root.
El HEALTHCHECK usa únicamente 127.0.0.1 y PORT, sin proxies heredados ni curl.
EXPOSE 8000 es metadato: el puerto efectivo lo determina PORT.

El smoke no construye imágenes. Crea una red bridge exclusiva y un contenedor
con nombres aleatorios, sin upstream ni volúmenes, filesystem de solo lectura,
capabilities eliminadas, no-new-privileges, límites de memoria/PIDs/CPU y tmpfs
pequeño. Publica solo `127.0.0.1:18083` hacia PORT=8083 para comprobar un valor
distinto del predeterminado. Si 18083 está ocupado, informa y elige otro puerto
libre; una carrera de asignación causa fallo y limpieza, nunca detiene recursos ajenos.
Rechaza motores configurados mediante endpoints TCP/SSH: exige pipe o socket local.

Comprueba healthy, health 200, usuarios/me 503 con no-store, UID/GID, pip check,
ausencia de `.env`/entornos/tests y de imports backend, flags de aislamiento,
publicación loopback y que la red solo tenga el contenedor propio. Confirma apagado
en logs y salida 0 (también admite 143 si Uvicorn vuelve a emitir SIGTERM después
de cerrar). Finalmente elimina exclusivamente el contenedor y red creados, incluso
ante fallo; conserva la imagen. No usa prune ni borra volúmenes/imágenes.

Verificado en Docker Desktop Linux/amd64: Python 3.13.18, HTTP 200/503 y no-store,
healthy, UID/GID 10001 y apagado con salida 0. Suite host: 120 pruebas aprobadas;
regresión TCP loopback aprobada. Evidencias y fallos intermedios en el documento
SCRUM-83. La suite completa no se ejecutó dentro de la imagen de producción.

Una red `internal` no permitió acceder al puerto publicado desde este Windows;
por eso el smoke usa bridge exclusiva. Esa red no bloquea salida a Internet: no
se configura upstream ni se contactan servicios de negocio externos, pero esta
prueba Docker no es una auditoría de egress. No se acreditan Render, otras
arquitecturas, carga ni un escaneo integral de vulnerabilidades de la imagen.

## Estado posterior: PoC en Render

El usuario confirmó un despliegue real del commit `073c33e`, rama
`SCRUM-83-Validar-Gateway-despliegue-y-documentación`, en el servicio
`roomies-scrum83-api-gateway` del proyecto `roomies-scrum77-poc`, entorno Staging,
plan Free y runtime Docker:
[URL de la PoC](https://roomies-scrum83-api-gateway.onrender.com).

Estado reportado: **Deploy succeeded / Live**. Dockerfile:
`backend/api-gateway/Dockerfile`; Docker Build Context Directory:
`backend/api-gateway`; Root Directory vacío; Health Check Path `/health`;
Auto-Deploy **Off**. No se configuraron variables de entorno ni secretos para esta
PoC. La duración del despliegue fue **44 segundos; no es una medición de cold start**.

Verificaciones remotas confirmadas por el usuario: `/health` respondió desde el
navegador con `{"status":"ok"}`; `/usuarios/me`, consultado con `curl.exe -i`,
devolvió **503 Service Unavailable**, **Cache-Control: no-store** y
`{"detail":"Servicio no configurado."}`. Los registros de Render confirmaron el
arranque correcto de Uvicorn. No se repitieron esas consultas en esta actualización.

`AUTH_USERS_UPSTREAM_URL` sigue sin configurar. No se ha probado comunicación
remota Gateway → Auth/Users ni validado Supabase Auth, PostgreSQL o Listado mediante
este despliegue. No se acredita integración del sistema completo; no se usan
credenciales ni servicios de producción.

Las referencias anteriores a Render no comprobado describen las fases previas y
se conservan como historial. Los detalles y límites de la evidencia posterior están
en [la documentación SCRUM-83](../../docs/SCRUM-83-gateway-independiente.md#evidencia-posterior-poc-desplegada-y-comprobada-en-render).

## Estado posterior: comunicación remota con Auth/Users

El usuario confirmó que configuró únicamente `roomies-scrum83-api-gateway` en
Render con `AUTH_USERS_UPSTREAM_URL=https://roomies-scrum77-auth-users.onrender.com`
y guardó mediante **Save and deploy**, sin modificar código ni el servicio
Auth/Users. Este estado sucede a la PoC sin upstream conservada arriba.

Tras un **502 transitorio de causa no confirmada**, se comprobaron HTTP **200**
en `/health` del Gateway y en `/health` directo de Auth/Users. El
**GET /usuarios/me a través del Gateway** devolvió HTTP **503**,
`Content-Type: application/json`, `Cache-Control: no-store` y:

```json
{"detail":"La verificación de identidad no está configurada."}
```

Esto acredita comunicación HTTP remota Gateway → Auth/Users y propagación de esa
respuesta controlada para GET. No se ha validado autenticación funcional con
Supabase Auth, operaciones PostgreSQL, perfiles reales, Listado/Applications,
PATCH remoto ni reenvío de un JWT real. No acredita integración del sistema completo.

Ambos servicios siguen en plan **Free** y pueden experimentar arranques en frío;
no hay evidencia para atribuirles el 502 inicial ni una medición de cold start.
No se usan credenciales ni servicios de producción. Esta actualización documental
no consultó servicios externos ni alteró configuración.

La secuencia, el alcance y los pendientes están registrados en
[la evidencia de comunicación remota de SCRUM-83](../../docs/SCRUM-83-gateway-independiente.md#evidencia-posterior-comunicación-http-remota-gateway--authusers).
