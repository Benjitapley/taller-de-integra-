# SCRUM-83 — Gateway independiente, primera fase aislada

## Decisión y autorización

Según la información comunicada por el usuario, Gus confirmó que el backlog exige
un API Gateway independiente para reenviar HTTP a los microservicios. Esto motiva
evolucionar la decisión histórica de SCRUM-71. No se revisó acta ni aprobación
arquitectónica formal; no se acredita aquí su existencia.

El usuario autorizó expresamente la implementación local aislada el 3 de noviembre
de 2026. Esa autorización no equivale a aprobación formal del equipo, integración
de PR ni autorización de despliegue.

## Evidencia del checkout

Base `32228a1`, rama `SCRUM-83-Validar-Gateway-despliegue-y-documentación`,
estado inicial limpio. FastAPI central reúne Auth antiguo, Match, administración,
publicaciones y perfil, con PostgreSQL durante startup. Auth antiguo usa JWT HS256.
Next.js consume `/auth/*` y GET/PUT `/api/perfil`; ese contrato se conserva.
No se encontró código móvil que permita verificar Supabase Auth en este checkout.

El estado de SCRUM-77, PR #23 y Render es información reportada por el usuario.
No se inspeccionó su worktree ni se copiaron archivos, combinaron ramas o llamaron
servicios desplegados. Tampoco se revisaron las ramas de Benjamín.

## Implementación comprobable localmente

`backend/api-gateway/` contiene configuración, aplicación FastAPI, proxy limitado
a GET/PATCH `/usuarios/me`, health independiente y pruebas aisladas. No importa
el central ni emite/valida JWT; Auth/Users mantiene identidad y permisos.

Conserva método, query raw, cuerpos y códigos. Filtra cabeceras, impone no-store,
evita redirects/reintentos y cierra el cliente compartido. Errores propios: 502 de
comunicación, 503 sin configurar y 504 de timeout. El README enumera allowlists,
excepciones a transparencia, configuración, ejecución y limitaciones.

No se cambiaron backend central, Auth antiguo, Match, administración, frontend,
servicios ajenos ni el worktree SCRUM-77. No se implementó Listado ni acceso a BD.

## Verificación

Desde `backend/api-gateway/`, con el entorno local instalado:

```powershell
.\.venv\Scripts\python.exe -I -B tests/run_isolated.py --tb=short
```

Dependencias directas/transitivas fijadas; Python 3.13.1. Solo la instalación usó
el registro de paquetes. No se instalaron dependencias globales ni se usaron
credenciales, bases de datos o servicios de negocio remotos.

Historial de ejecución:

- ensurepip falló durante venv; se instaló en su intérprete local con pip `--python`.
  La descarga inicial falló por DNS del sandbox; la instalación autorizada fuera
  del sandbox terminó correctamente.
- Primera colección: WinError 10106 al eliminar variables necesarias para asyncio.
  El runner conserva ahora variables básicas de Windows. El sandbox también bloqueó
  el socket interno: las ejecuciones completas se hicieron fuera del sandbox,
  manteniendo los bloqueos de red externa del runner.
- Primera suite completa: 20 fallos y 34 aprobadas. Se corrigieron streams del
  simulador ya consumidos y el modo de imports de pytest que cargaba `backend`.
- Suite corregida: 54 aprobadas. Suite ampliada: 58 aprobadas, sin fallos ni omitidas.
- Verificación final tras los ajustes: `58 passed in 2.08s` (salida 0).
- `pip check`: `No broken requirements found.`
- Sintaxis válida de los 6 archivos Python y `git diff --check` sin errores.
  El prefijo histórico de SCRUM-71 coincide byte por byte con HEAD aplicando
  la conversión de checkout de Git (CRLF); solo se añadió la sección final.

ASGITransport/MockTransport verifican contratos en memoria, errores/timeouts
inyectados, cierre de streams/cliente, rutas/métodos, cabeceras, Bearer ficticio,
compresión y aislamiento de imports/red. El runner falla si registra conexiones
reales o imports prohibidos. No demuestra seguridad integral, duración real de
timeouts, TCP, listener Uvicorn, JWT reales ni compatibilidad de servicios desplegados.

## Pendientes del equipo

1. SCRUM-77: schemas `/usuarios/me`, PATCH, nulos, errores, límites y cabeceras.
   JWT Supabase/JWKS, UUID/BIGINT y permisos pertenecen al servicio. Sin conversión
   HS256 ni alias de `/api/perfil`.
2. Benjamín Cabrera: rama/commit, endpoints reales, schemas, prefijos, filtros,
   paginación, acceso público/privado, propiedad, identidad, uploads y convivencia
   con CRUD central. Health no acredita un Listado funcional.
3. Acordar consumidores móviles/web, CORS y migración compatible. Los consumidores
   actuales siguen usando el contrato antiguo.
4. Otra fase: TCP local simulado, límites de memoria, deadline total y observabilidad
   sanitizada antes de exposición pública. Docker/integración/despliegue pendientes.

La comprobación histórica de SCRUM-71 se conserva y no se presenta como prueba del
nuevo Gateway. Su sección adicional enlaza esta evolución.

## Validación HTTP real en loopback — continuación de SCRUM-83

El usuario reportó una verificación manual previa con Uvicorn: health 200,
usuarios/me sin upstream 503 y no-store presente; indicó que detuvo ese servidor.
La continuación agrega exclusivamente `backend/api-gateway/tests/run_loopback.py`
y esta documentación. No cambia el Gateway ni componentes de otros integrantes.

Desde `backend/api-gateway/`, con el entorno virtual existente:

```powershell
.\.venv\Scripts\python.exe -I -B tests/run_loopback.py
```

El script reserva dos sockets IPv4 en `127.0.0.1:0`, deja que el sistema elija
puertos libres y pasa los sockets ya reservados a dos procesos independientes
mediante multiprocessing spawn. Cada proceso ejecuta Uvicorn: uno sirve el Gateway
real y otro una aplicación Auth/Users ficticia. No se usan MockTransport ni
ASGITransport en este script: tanto cliente→Gateway como Gateway→simulado usan TCP.
La reserva evita liberar un puerto entre elegirlo y arrancar el servidor.

El simulado reporta por una cola IPC método, ruta raw, query raw, cuerpo,
Authorization y Content-Type. No imprime tokens o cuerpos. Todos los datos y el
Bearer son ficticios. Se comprueban:

- GET con query repetida, valor vacío, caracteres codificados y signo `+`: status
  200, cuerpo JSON exacto, Content-Type y no-store.
- PATCH con la misma query y JSON ficticio con espacios: bytes exactos recibidos,
  Bearer intacto, Content-Type, status 200 y respuesta JSON exacta.
- PATCH con respuesta 503 ficticia: conserva código y cuerpo de texto, con no-store.
- PATCH que registra la escritura antes de esperar 0,6 segundos, frente al timeout
  de lectura de 0,2 segundos del Gateway: devuelve 504 sanitizado con no-store.
- Tras esperar otros 0,8 segundos, el simulado debe haber recibido exactamente
  cuatro llamadas: un GET y tres PATCH, una por cada escenario. Esto comprueba
  ausencia de reintentos de escritura en los escenarios ejecutados; no afirma
  semántica exactly-once en sistemas distribuidos. El timeout no prueba rollback.

Se limpian las variables heredadas salvo las básicas de Windows y se deshabilitan
proxies heredados, access logs y redirects del cliente. En padre e hijos, hooks
de auditoría de Python restringen connect/getaddrinfo a los puertos autorizados
en 127.0.0.1 y bloquean sendto. Se admite únicamente la creación interna del
socketpair que necesita asyncio. El simulado no puede abrir conexiones de negocio;
el Gateway solo puede conectar al puerto del simulado. Cualquier intento bloqueado
hace fallar la comprobación normal. No se importaron servicios reales.

Este control cubre las operaciones socket Python de estos procesos; no es un
firewall ni acredita aislamiento de extensiones nativas arbitrarias. La ausencia
de intentos externos se limita a esta ejecución instrumentada. No se contacta
Render, Supabase, PostgreSQL ni un proveedor de identidad.

El bloque finally solicita cierre de ambos servidores, espera su terminación y,
si es necesario, termina únicamente los procesos creados por el script. También
cierra sockets y cola IPC. La ejecución normal falla si el cierre requiere fuerza
o quedan procesos activos. Para comprobar el camino de fallo deliberado:

```powershell
.\.venv\Scripts\python.exe -I -B tests/run_loopback.py --fail-after-start
```

Ese comando debe salir con código 1 y mostrar el fallo deliberado junto con
`Limpieza: 2 procesos; activos=0; cierres forzados=0`. No es un escenario HTTP
aprobado: es una comprobación del cierre tras fallar después del arranque.

Resultados observados en este equipo Windows/Python 3.13.1:

- Primer intento dentro del sandbox: falló con WinError 2 al transferir sockets
  a los hijos por named pipe. Se cerraron ambos procesos; no se presentó como aprobado.
- Ejecución autorizada fuera del sandbox: integración HTTP completa aprobada,
  cuatro llamadas exactas, sin intentos de red fuera del loopback autorizado.
- Fallo deliberado: salida 1 esperada, dos procesos terminados, cero activos y
  cero cierres forzados.
- Repetición final de integración: salida 0, los cuatro escenarios aprobados y
  cierre normal de ambos procesos. Regresión en memoria: `58 passed in 1.75s`.

Esta prueba amplía la evidencia anterior en memoria con Uvicorn y TCP local; no
acredita JWT reales, SCRUM-77 desplegado, contratos móviles/web o Listado, ni carga,
límites de memoria, TLS o exposición pública. Esos pendientes siguen vigentes.

## Corrección autorizada de los cuatro hallazgos P1/P2

Esta sección actualiza el estado de los límites y dependencias descritos en las
fases anteriores, conservando su historial. Se modificaron únicamente archivos
del Gateway, sus pruebas, plantilla de entorno y documentación SCRUM-83.

### Memoria y codificaciones

Los cuerpos se reciben por fragmentos contando bytes efectivos, sin depender
de Content-Length: 1 MiB de solicitud y 2 MiB de respuesta por defecto. Son
configurables con `GATEWAY_MAX_REQUEST_BYTES` / `GATEWAY_MAX_RESPONSE_BYTES`, entre
1 byte y 16 MiB. Un byte extra basta para rechazar: 413 entrante, 502 genérico
para respuesta upstream excesiva, cerrando su stream. Se verifican límites exactos,
fragmentados, sin longitud declarada y con longitud falsa en transporte simulado.

No se retiene una lista de todos los fragmentos: un bytearray acotado se convierte
una vez en bytes. La copia final, reserva adicional del bytearray, chunks entregados
por servidor/HTTPX, cuerpo retenido de solicitud y concurrencia agregan memoria.
Esto acota el buffering de la aplicación, no el RSS total; no se realizó perfilado
de memoria ni pruebas de carga.

Solo se acepta Content-Encoding ausente o una única cabecera identity, sin distinguir
mayúsculas. gzip, br, listas, duplicados y valor vacío producen 415 sin llamar al
upstream. Las respuestas mantienen los bytes raw y Content-Encoding, recalculando
Content-Length con el tamaño efectivo; no se inventa longitud en 204/304. Si
Connection intenta suprimir Content-Encoding de la respuesta, se devuelve 502.
Se normalizan a minúsculas los nombres de cabeceras que salen por ASGI.

### Rutas y dependencias

Las decisiones sobre ruta privada y alias codificados usan `scope['path']` y
`scope['raw_path']`, nunca `request.url.path`. Host malformado no cambia la ruta
autorizada ni omite no-store, tanto en pruebas ASGI como TCP.

Se revisó [GHSA-86qp-5c8j-p5mr](https://github.com/Kludex/starlette/security/advisories/GHSA-86qp-5c8j-p5mr):
el aviso indica versiones afectadas hasta 1.0.0 y corrección en 1.0.1. Se verificó
en los metadatos instalados que FastAPI 0.115.12 exigía Starlette >=0.40.0,<0.47.0;
no era válido actualizar únicamente Starlette.

Se resolvió e instaló en el entorno virtual local FastAPI **0.162.0** con Starlette
**1.10.0**. Metadatos efectivos: FastAPI requiere Starlette >=0.46.0 y Pydantic
>=2.9.0; Starlette requiere AnyIO >=4.0.0,<5. Versiones efectivas restantes:
Pydantic 2.14.2, AnyIO 4.16.0, HTTPX 0.28.1, Uvicorn 0.34.2 y pytest 8.3.5.
Las nuevas dependencias transitivas annotated-doc 0.0.5 y opentelemetry-api 1.45.2
quedaron fijadas. Se instala solamente la API de telemetría, no un SDK/exportador.
`pip check` informa `No broken requirements found.` No se forzaron dependencias
incompatibles ni se modificaron paquetes globales. No es un escaneo integral de CVE.

### Plazos y errores

`GATEWAY_CLIENT_BODY_TIMEOUT` (5 segundos) limita toda la recepción del cuerpo.
`GATEWAY_TOTAL_TIMEOUT` (15 segundos) comparte un único presupuesto desde que el
proxy empieza a recibir hasta terminar la lectura del upstream. No se renueva
con cada fragmento. Se conservan además connect/read/write/pool timeouts HTTPX.
Todos los plazos son finitos, positivos y de hasta 120 segundos.

Timeout durante recepción: 408 genérico; durante upstream: 504 genérico. La limpieza
del stream tiene hasta 1 segundo adicional y está protegida frente a cancelación.
El plazo no incluye cabeceras recibidas por Uvicorn antes del handler ni la entrega
final al consumidor. PATCH mantiene retries=0 y no se reenvía automáticamente.
Un 504 no acredita que el servicio haya revertido una escritura.

### Pruebas de esta corrección

Comandos desde `backend/api-gateway/` (sin servicios reales):

```powershell
.\.venv\Scripts\python.exe -I -B tests/run_isolated.py --tb=short
.\.venv\Scripts\python.exe -I -B tests/run_loopback.py
.\.venv\Scripts\python.exe -I -B tests/run_loopback.py --fail-after-start
```

Se ejecutan fuera del sandbox Windows cuando éste impide sockets/IPC, conservando
los bloqueos de conexiones externas de los runners. El último comando debe salir
con código 1 deliberadamente y cerrar ambos servidores.

Historial observado durante la corrección:

- Primera ampliación en memoria: `104 passed in 3.47s`.
- Suite ampliada a 110: `1 failed, 109 passed in 4.01s`; la prueba gzip detectó
  que el chequeo de Content-Encoding no reconocía nombres raw con mayúsculas.
  Se corrigió la normalización ASGI del filtro; no se debilitó la prueba.
- Repetición completa: `110 passed in 3.37s`, sin fallos ni omitidas.
- Integración TCP ampliada aprobada: health, GET/PATCH, Bearer ficticio, query/cuerpos,
  503/504, Host malformado, límites exactos y exceso por fragmentos, 413/502,
  gzip rechazado/identity aceptado, recepción continua lenta 408 y upstream con
  fragmentos continuos 504. También gzip raw y Content-Length coherente.
- Exactamente 11 llamadas al simulado: cada PATCH aceptado llega una vez;
  rechazos 413/415/408 no llegan al servicio. Sin intentos externos detectados,
  sin imports de servicios reales. Ambos procesos cierran sin fuerza y sin activos.
- Repetición TCP final tras normalizar cabeceras: salida 0, mismos resultados.
  Fallo deliberado final: salida 1 esperada, cero activos y cero cierres forzados.
  `pip check` final sin incompatibilidades y sintaxis válida en los 7 archivos Python.

Siguen pendientes Docker/Linux/TLS, control global de concurrencia y carga,
política de logs de infraestructura, entrega a clientes lentos y contratos reales
con SCRUM-77 y Listado. El Gateway no sanea secretos incrustados en cuerpos o
cabeceras permitidas del upstream. No se hicieron despliegues ni llamadas a
Render, Supabase, PostgreSQL o servicios de negocio reales.

## Docker local autorizado — construcción y smoke real

Se revisaron nuevamente las cuatro correcciones en app: límites por bytes,
scope ASGI para rutas, plazos de recepción/operación y rechazo de codificación.
Las dependencias siguen fijadas y coherentes. No se modificó lógica de app en
esta etapa; se agregaron Dockerfile, .dockerignore, docker/runtime.py,
tests/test_container_runtime.py y tests/run_docker.py, además de actualizar README
y este documento. SCRUM-71 y componentes ajenos no se modificaron en esta etapa.

### Construcción reproducible

Desde la raíz `taller-de-integra-scrum83`, el contexto elegido es solamente
`backend/api-gateway`, nunca la raíz del repositorio:

```powershell
docker build --tag roomies-api-gateway --file backend/api-gateway/Dockerfile backend/api-gateway
```

En este Windows el CLI no estaba en PATH y el sandbox no permitía el named pipe.
Se encontró Docker Desktop por usuario y se autorizó el acceso al motor local.
Comando exacto usado fuera del sandbox:

```powershell
$env:PATH = 'C:\Users\ALUMNO\AppData\Local\Programs\DockerDesktop\resources\bin;' + $env:PATH
& 'C:\Users\ALUMNO\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe' build --tag roomies-api-gateway --file backend/api-gateway/Dockerfile backend/api-gateway
```

Motor observado: Docker 29.9.2, Docker Desktop 4.97.0, contexto desktop-linux,
Linux/amd64. Base Python 3.13 slim-bookworm fijada con digest resuelto por Docker:
`sha256:281d39ff02e3b389401586134ff9e6572954687822a58055ec07a60ded4e0b7f`.
Python efectivo en el contenedor: **3.13.18**.

La imagen instala únicamente las wheels de requirements.txt y ejecuta pip check.
La instalación se hace dentro del build, sin modificar paquetes globales del host.
No se instalaron pytest ni los tests en la imagen de producción. Los cuatro módulos
app son los únicos fuentes de aplicación copiados; no se importa backend central.
La allowlist del contexto excluye entornos, variables locales, secretos, cachés,
tests y archivos de otros componentes. El usuario runtime es **10001:10001**, sin
privilegios y sin permisos para sobrescribir el código propiedad de root.

docker/runtime.py valida PORT y hace exec de Uvicorn como PID 1, sin shell,
escuchando en 0.0.0.0. Predeterminado 8000; el smoke usa 8083 para acreditar que
respeta la variable. Access logs y proxy headers deshabilitados. El HEALTHCHECK
consulta únicamente 127.0.0.1:PORT/health con proxies deshabilitados.

### Smoke y recursos temporales

Comando exacto desde la raíz:

```powershell
backend/api-gateway/.venv/Scripts/python.exe -I -B backend/api-gateway/tests/run_docker.py --docker 'C:\Users\ALUMNO\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
```

El script exige un endpoint local del motor. Crea un contenedor y una red bridge
exclusivos, con nombres aleatorios y etiqueta `roomies.scrum83.local-test`.
Publicó **127.0.0.1:18083 → 8083**; 18083 estaba libre. Si está ocupado, el script
informa y elige otro puerto libre, sin detener recursos ajenos. Sin upstream,
bind mounts ni volúmenes; no comparte red con contenedores existentes. Se comprueba
que el único miembro de su red sea su contenedor.

Flags efectivos comprobados: filesystem read-only, cap-drop ALL,
no-new-privileges y publicación solo loopback. También se configuran memoria
128 MiB, CPU 1, PIDs 64 y tmpfs de 8 MiB en /tmp. La red bridge exclusiva permite
egress: esta prueba no acredita un firewall o ausencia integral de tráfico saliente.
El Gateway no tiene upstream y los checks HTTP consultan solo loopback.

Resultados de la ejecución final (salida 0):

- HEALTHCHECK Docker: **healthy**.
- GET /health desde Windows: **200**, `{"status":"ok"}`.
- GET /usuarios/me sin upstream: **503**, `{"detail":"Servicio no configurado."}`,
  **Cache-Control: no-store**.
- UID/GID **10001:10001**; `pip check` sin incompatibilidades dentro de la imagen.
- Sin imports backend, `.venv`, `.env` o tests en /gateway; archivos app solo Python.
- Parada SIGTERM: log `Application shutdown complete.` y **código de salida 0**.
- Contenedor y red propios eliminados. Comprobación posterior filtrada por su
  etiqueta: **cero contenedores y cero redes**. Imagen conservada; ningún prune,
  borrado de imágenes/volúmenes o actuación sobre recursos de otras tareas.

Imagen final inspeccionada:
`sha256:4fadfae8465ca679e5e02ed31c863989e940816178fe0d5f925c8697802fa208`,
Linux/amd64, **207797116 bytes**, Config.User **10001:10001**.

### Fallos intermedios y otras verificaciones

- Primer build: no encontraba docker-credential-desktop. Se añadió el directorio
  del CLI solo al PATH del proceso; no se leyeron archivos de credenciales ni
  se hizo login. Build posterior correcto y luego fijado por digest.
- Primer smoke: healthy dentro del contenedor, pero la red `internal` no permitió
  acceder al puerto publicado desde Windows (WinError 10061). Se limpiaron sus
  recursos; se repitió con bridge exclusiva, sin conectar otros contenedores.
- Segundo smoke: superó HTTP y falló el control de archivos adicionales en app.
  Se reforzó .dockerignore para no reincluir recursivamente archivos no permitidos,
  con exclusiones explícitas de cachés/secretos. Se reconstruyó; smoke final completo
  aprobado. También en ese fallo se eliminaron contenedor y red temporales.
- Suite aislada completa en host, incluidos 10 casos nuevos de PORT/exec:
  **120 passed in 3.65s**, sin fallos ni omitidas.
- Regresión TCP loopback completa: **aprobada**, once llamadas exactas, cada PATCH
  aceptado una vez, sin intentos externos detectados por su instrumentación y cierre
  de ambos procesos sin fuerza ni activos.

La suite completa se ejecutó en Windows, no dentro de la imagen Linux; en Linux
se acreditó el smoke descrito. No se hicieron carga, escaneo integral de CVE,
integración con Auth real, otras arquitecturas ni validación TLS/Render.
No se desplegó, publicó imagen ni se subieron cambios a GitHub. La siguiente etapa
requiere revisión del usuario; Render sigue sin autorización.

## Evidencia posterior: PoC desplegada y comprobada en Render

Esta sección registra el despliegue real y las verificaciones remotas confirmadas
por el usuario. Actualiza el estado respecto de las fases anteriores, cuyo contenido
se conserva como historial: las referencias anteriores a Render pendiente o todavía
no autorizado corresponden a esas etapas. Esta actualización documental no ejecutó
un despliegue, no modificó Render ni repitió las solicitudes remotas.

### Servicio y configuración reportados

| Dato | Valor confirmado |
| --- | --- |
| Proyecto Render | `roomies-scrum77-poc` |
| Entorno | Staging |
| Servicio | `roomies-scrum83-api-gateway` |
| Plan | Free |
| Runtime | Docker |
| Rama | `SCRUM-83-Validar-Gateway-despliegue-y-documentación` |
| Commit desplegado | `073c33e` |
| URL pública | [roomies-scrum83-api-gateway.onrender.com](https://roomies-scrum83-api-gateway.onrender.com) |
| Dockerfile | `backend/api-gateway/Dockerfile` |
| Docker Build Context Directory | `backend/api-gateway` |
| Root Directory | Vacío |
| Health Check Path | `/health` |
| Auto-Deploy | Off |
| Variables de entorno y secretos configurados para esta PoC | Ninguno |
| Estado observado | Deploy succeeded / Live |
| Duración del despliegue | 44 segundos |

Los **44 segundos corresponden a la duración del despliegue**, no a una medición
de cold start ni de latencia de respuesta. La ausencia de variables configuradas
para esta PoC no significa que Render carezca de variables automáticas de plataforma.

### Verificaciones remotas confirmadas

1. `GET /health`, abierto desde el navegador, respondió con `{"status":"ok"}`.
2. `GET /usuarios/me` fue comprobado mediante `curl.exe -i` y devolvió
   **503 Service Unavailable**, con **Cache-Control: no-store** y el cuerpo
   `{"detail":"Servicio no configurado."}`.
3. Según la revisión de registros de Render comunicada por el usuario, Uvicorn
   inició correctamente.

La consulta de perfil corresponde a la URL
[usuarios/me](https://roomies-scrum83-api-gateway.onrender.com/usuarios/me).
Para reproducir esa comprobación sin token ni credenciales:

```powershell
curl.exe -i https://roomies-scrum83-api-gateway.onrender.com/usuarios/me
```

La respuesta 503 acredita el comportamiento controlado del Gateway sin servicio
destino configurado; no acredita una respuesta de Auth/Users. El health acredita
que la aplicación atiende esa ruta, sin comprobar disponibilidad de dependencias.

### Alcance y limitaciones de esta evidencia

- `AUTH_USERS_UPSTREAM_URL` todavía no está configurado.
- No se ha probado comunicación remota Gateway → Auth/Users.
- No se ha validado Supabase Auth, PostgreSQL ni Listado mediante este despliegue.
- No se acredita que el sistema completo esté integrado ni que los clientes
  móviles/web funcionen contra esta PoC.
- No se midió cold start; los 44 segundos no deben reutilizarse como esa métrica.
- Esta PoC no utiliza credenciales ni servicios de producción. No se incorporan
  secretos a la documentación.

La siguiente integración requiere acordar el contrato y disponibilidad de Auth/Users
y, por separado, el contrato de Listado con Benjamín Cabrera. Esta evidencia de
infraestructura no cierra esas dependencias ni autoriza cambios adicionales en Render.
