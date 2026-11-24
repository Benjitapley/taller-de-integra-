# SCRUM-100 · Validación de Kubero

## Evidencia disponible

### Pruebas y observaciones del equipo

- **Observado en la auditoría previa.** En el Kubero universitario (`kubero.inf.uct.cl`), equipo `integral_IV_grupo6`, pipeline `roomies`, etapa Production, se vio la aplicación de demostración `server` (Node.js, puerto 3000). Su complemento mostraba PostgreSQL 17.6, `server-postgres:5432` y el contenedor `server-postgres-0`. Los logs mostraban recuperación automática y posterior disponibilidad para conexiones.
- **Validado localmente en SCRUM-100.** `python -m pytest backend/local_stack/test_runtime.py -q` registró **91 pruebas aprobadas**. La suite comprueba la selección de destino, la política TLS del DSN, Supabase Auth, la compatibilidad con `disposable` y `supabase` y el cifrado y descifrado DPAPI de bytes sintéticos. Estas pruebas no abren conexiones SQL ni HTTP. La [evidencia histórica de Convivencia](../contracts/incorporacion.evidencia.md) registra pruebas SQL contra PostgreSQL desechable local, con identidad y Listado simulados.
- **Validado en Kubero.** El ensayo se realizó en el pipeline `roomies`, etapa `test`, separado de la aplicación de demostración en Production. PostgreSQL 17.6 está desplegado en `roomies-db-test2`, con el Service DNS interno `roomies-db-test2-postgres`. La base de ensayo `roomies-db-test2` se creó manualmente. La matriz registra el alcance de la sonda SQL, el respaldo y la restauración, y la respuesta pública del Gateway.

- **Prueba local aprobada el 22 de noviembre de 2026.** Desde un segundo computador, con Python 3.13.1 y pytest 9.1.1, la ejecución de `backend/local_stack/test_runtime.py` registró **91 passed in 2.07s**. Esta repetición conserva el alcance local de la suite descrito arriba; no comprueba conexiones SQL ni HTTP.
- **Prueba HTTP aprobada el 22 de noviembre de 2026.** El Gateway público `https://roomies-gateway-test.inf.uct.cl/health` respondió **HTTP 200**, con `{"status":"ok"}`. Su disponibilidad no demuestra conectividad con los microservicios que todavía no están desplegados.
- **Prueba HTTPS desde Temuco del 24 de noviembre de 2026.** El equipo accedió al [`/health` público del Gateway](https://roomies-gateway-test.inf.uct.cl/health) desde un PC de Temuco y obtuvo `{"status":"ok"}`.
- **Observaciones de Kubero del 22 de noviembre de 2026.** Los registros consultados mostraron arranque correcto de Uvicorn, `Application startup complete` y escucha en `0.0.0.0:8000`, sin errores visibles en ese alcance. PostgreSQL 17.6 continúa disponible en `roomies-db-test2-postgres:5432`. El registro de `public.prueba_persistencia_scrum100` sigue existiendo con `id=1` y `mensaje='Roomies SCRUM-100'`.
- **Configuración y límites de la evidencia de persistencia del 22 de noviembre de 2026.** `SHOW data_directory` confirmó `/var/lib/postgresql/data/pgdata`. La plantilla `KuberoApp` de `roomies-db-test2` declara el complemento `KuberoAddonPostgres`, PostgreSQL 17.6, una réplica y `persistence.enabled: true`, con volumen solicitado de 8 GiB. Son observaciones de configuración, no una prueba de recuperación del dato tras reinicio o reemplazo del Pod. `pg_postmaster_start_time()` devolvió `2026-11-20 23:52:48.641337+00`; este dato no prueba por sí solo que haya existido un reinicio después de insertar el registro.
- **Limitaciones operativas observadas el 22 de noviembre de 2026.** La sección Eventos de Kubero no mostró eventos disponibles; la interfaz informa una retención predeterminada aproximada de una hora. El contenedor administrativo no dispone de `kubectl`. La opción «Reiniciar» de la aplicación no permite determinar si también reinicia el Pod de PostgreSQL, por lo que no se utilizó. El equipo no realizó un reinicio o reemplazo controlado del Pod PostgreSQL en esa fecha.
- **Prueba TLS pendiente al 22 de noviembre de 2026.** El equipo observó `ssl=off` en PostgreSQL. La conexión del runtime en modo `kubero` con TLS verificado quedó bloqueada.

- **Validación real confirmada por el equipo el 23 de noviembre de 2026.** En Kubero TEST se desplegó `roomies-match-test` con la imagen `ghcr.io/cparra2007/roomies-match-conexion:sha-72e4bd6`, correspondiente al commit `72e4bd6`. FastAPI funciona y el Pod figura listo, `1/1`. Desde su contenedor se ejecutó `PostgresConnections().connect()`, que utiliza el validador compartido `database_url()`, y consultas SQL reales de solo lectura. La salida confirmada fue:

  ```text
  current_user: sql_match_conexion
  current_database: roomies-db-test2
  inet_server_port: 5432
  ssl: False
  OK: conexion TEST sin TLS verificada.
  ```

  El destino interno es `roomies-db-test2-postgres:5432`; PostgreSQL mantiene `ssl=off`. El equipo aprobó la excepción sin TLS exclusivamente para Kubero TEST. Esto acredita conexión desde Match con el rol esperado y sesión sin cifrado, no validación TLS, privilegios efectivos sobre tablas ni recorrido HTTP de negocio. Esta actualización registra la evidencia aportada por el equipo; no realizó consultas remotas adicionales.

SCRUM-100 sigue en curso. La migración de datos históricos de S3R-B03 queda pendiente de ejecución y comparación antes/después, como dependencia separada del cierre de B02.

### Respaldo y restauración en TEST · 24 de noviembre de 2026

En PostgreSQL 17.6, se respaldó la base `roomies-db-test2` con `pg_dump -Fc`. El archivo `/tmp/roomies-scrum100-backup.dump`, de aproximadamente 2,2 KB, quedó temporalmente dentro del contenedor administrador. El listado de `pg_restore --list` confirmó entradas para la tabla `public.prueba_persistencia_scrum100`, sus datos, su clave primaria y su ACL.

`pg_restore` terminó sin errores visibles en la base de recuperación independiente `roomies_restore_scrum100_24nov`. La base restaurada devolvió `1 | Roomies SCRUM-100`. Una consulta posterior a la base original devolvió el mismo registro, lo que confirma que el dato de ensayo se conservó en el origen.

El ensayo del equipo comprobó la recuperación del registro desde su respaldo. Sigue pendiente disponer de una copia externa duradera y verificar los permisos efectivos en la base restaurada. El YAML del complemento declara persistencia habilitada, 8 GiB y modo de acceso `ReadWriteOnce`. Durante la restauración del equipo, PostgreSQL siguió en funcionamiento y el PVC quedó sin inspección directa.

### Permisos SQL de Match en TEST

Las comprobaciones del rol `sql_match_conexion` en Kubero TEST confirmaron estos resultados:

| Alcance | Resultado |
|---|---|
| Atributos del rol | `LOGIN` permitido. `SUPERUSER`, `CREATEDB`, `CREATEROLE` y `REPLICATION` desactivados. |
| Base `roomies-db-test2` | `CONNECT` permitido y `CREATE` denegado. |
| Esquema `public` | `USAGE` permitido y `CREATE` denegado. |
| Tabla `public.prueba_persistencia_scrum100` | `SELECT` e `INSERT` denegados. |
| Membresías | La consulta a `pg_auth_members` devolvió 0 membresías directas. |

El aislamiento entre todos los dominios sigue pendiente. Para comprobar el acceso a tablas propias y la denegación de acceso cruzado, primero deben migrarse las tablas de cada dominio y configurarse sus roles respectivos.

### Comprobaciones reportadas por el ayudante de Kubero · 24 de noviembre de 2026

- **Volumen y reinicio.** El ayudante confirmó que el complemento PostgreSQL de `roomies-db-test2` usa almacenamiento persistente de 8 GiB. Informó que realizó un reinicio controlado del Pod PostgreSQL y que la base volvió a utilizar el mismo volumen y conservó el registro de `public.prueba_persistencia_scrum100`. La evidencia recibida es su reporte. Para acreditar por separado un reemplazo del Pod y la continuidad del volumen a nivel de Kubernetes, faltan los identificadores y mediciones de antes y después.
- **Match.** El ayudante informó que comprobó que Match seguía funcionando después del reinicio. La verificación comunicada aporta evidencia de continuidad de Match. Para reproducirla quedan por registrar la operación y su respuesta.
- **Respaldo previo.** El ayudante generó `roomies-db-test2.dump` con `pg_dump` en formato custom antes del reinicio. La restauración comprobada por el equipo corresponde al respaldo independiente de la sección anterior. Para el archivo del ayudante quedan por verificar la custodia duradera y su restauración.
- **TLS y red.** El ayudante confirmó que la instalación universitaria de Kubero actualmente no permite habilitar TLS en PostgreSQL del complemento. Indicó que la base es interna del clúster, sin acceso desde internet, y que la plataforma administra el aislamiento de red entre proyectos. Esta información describe el alcance de la red reportado por soporte. La conexión SQL de Match en TEST sigue amparada por la excepción sin TLS ya documentada.

## Topología A · FastAPI y PostgreSQL en Kubero

```text
Next.js / Expo ── HTTPS ──> Gateway público en Kubero
Next.js / Expo ── HTTPS ──> Supabase Auth (identidad y sesiones)
Gateway ── red privada ──> Auth/Users, Listado, Match, Convivencia
Servicios ── HTTPS ──> Supabase Auth (Auth y JWKS según operación)
Servicios ── red privada + TLS verificado ──> PostgreSQL de negocio en Kubero
```

El Gateway concentra el ingreso público de la API. Los servicios y PostgreSQL quedan sin ingreso público. Cada dominio usa un rol de ejecución propio y accede a otros dominios por API privada. El rol de migraciones se administra aparte. Para un despliegue nuevo se recomienda `private-v1` con esquemas por dominio. `haycupo-v1` corresponde al layout heredado y requiere un plan explícito de compatibilidad.

### Alternativa B · FastAPI temporalmente en otro host autorizado

Si el equipo autoriza otro host para los procesos FastAPI, PostgreSQL de negocio permanece en Kubero, tal como exige el contrato de Sprint 3. El host temporal debe alcanzar la base por una red privada o una ruta restringida a los procesos autorizados, con DNS accesible desde ese host y TLS verificado. El Gateway mantiene el ingreso HTTPS y Supabase Auth sigue a cargo de la identidad.

Si Kubero carece de DNS compatible, TLS verificable, almacenamiento persistente o capacidad de recuperación, registrar qué requisito queda bloqueado y la evidencia. El equipo debe decidir con la administración universitaria si se habilita la capacidad faltante o se aplaza el despliegue hasta poder operar PostgreSQL con seguridad en Kubero.

### Topología desplegada y prevista en TEST

El inventario corresponde al pipeline `roomies`, etapa `test`, con evidencia disponible al 24 de noviembre de 2026.

| Componente | Destino o acceso | Estado y evidencia |
|---|---|---|
| Gateway | Ingreso HTTPS público de `roomies-gateway-test`. | **Desplegado.** El equipo comprobó `/health`, incluida la respuesta desde un PC de Temuco. La revisión exacta de la imagen y las rutas hacia los servicios privados quedan por documentar. |
| Match/Conexión | `roomies-match-test` en Kubero. Conexión interna al servicio PostgreSQL por TCP `5432`. | **Desplegado.** Imagen `sha-72e4bd6`. El equipo comprobó la conexión SQL con el rol limitado y la excepción TEST. El ayudante informó que Match seguía funcionando tras el reinicio. El recorrido HTTP de negocio queda pendiente. |
| PostgreSQL | PostgreSQL 17.6 en `roomies-db-test2`, con DNS interno `roomies-db-test2-postgres`. | **Desplegado.** El equipo comprobó acceso SQL y restauración de un dato de ensayo. El ayudante confirmó el volumen persistente de 8 GiB y la conservación del dato tras reinicio. El complemento carece actualmente de TLS según su informe. |
| Auth/Users, Listado/Applications y Convivencia/Mensajería | Servicios privados previstos en la topología A. | **Planificados.** Sin despliegue acreditado en TEST. Su puesta en marcha y validación por servicio corresponden a SCRUM-102. |
| Reputación/Historial/Reportes | Servicio privado previsto por el contrato. | **Planificado.** El inventario local carece de un proceso ejecutable para este dominio. Su despliegue depende de contar con la implementación del servicio. |
| Supabase Auth, Next.js y Expo | Supabase Auth como proveedor externo de identidad. Next.js y Expo como clientes del Gateway HTTPS. | **Integración prevista.** Sigue pendiente la prueba del recorrido integrado de identidad y negocio en TEST. |

### Responsabilidades operativas por etapa

El ayudante realizó el reinicio puntual y aportó evidencia de infraestructura. Según su reporte, la plataforma administra el aislamiento de red entre proyectos. Las asignaciones operativas quedan por confirmar.

| Etapa | Trabajo operativo | Responsable |
|---|---|---|
| TEST | Coordinar la validación de DNS, ingreso HTTPS, certificado y rutas privadas en Kubero. | **Por confirmar** con la administración de Kubero. |
| TEST | Operar y verificar Gateway y Match. Conservar evidencia de las pruebas desde una red cliente. | **Por confirmar** en el equipo. |
| TEST | Verificar el volumen, autorizar intervenciones sobre PostgreSQL y definir custodia y retención de respaldos. | **Por confirmar** para operación de infraestructura y custodia del respaldo. |
| TEST | Registrar la aceptación de B02 y dar seguimiento a la limitación TLS. | **Por confirmar** quién registra la decisión y quién da seguimiento. La aceptación corresponde al equipo. |
| Production | Definir quién opera la aplicación de Roomies y la base de negocio, con TLS verificado, respaldo y recuperación. La aplicación universitaria de demostración queda fuera del alcance. | **Por confirmar** para la etapa Production de Roomies. |

## Dominios e imágenes

Inventario respecto de la base `7bf5089` y el contrato de microservicios Sprint 3 v2. Las rutas son relativas a `taller de integra dos/roomies-web`. En Kubero, ajustar el contexto si el checkout comienza en la raíz del repositorio. Usar `PORT=8000` para el primer ensayo.

| Componente | Estado en la base | Contexto | Dockerfile | Puerto y healthcheck |
|---|---|---|---|---|
| Gateway | FastAPI ejecutable | `backend/api-gateway` | `backend/api-gateway/Dockerfile` | `PORT`, 8000 por defecto. GET `/health` exige 200 y `{"status":"ok"}`. |
| Auth/Users | FastAPI ejecutable. Identidad de negocio y perfil | `.` | `backend/services/auth-users-service/Dockerfile` | `PORT`, 8000 por defecto. GET `/health` en loopback. |
| Listado/Applications | FastAPI ejecutable. Publicaciones y postulaciones | `.` | `backend/services/listado-applications-service/Dockerfile` | 8000 fijo. GET `/health` en loopback. |
| Match/Conexión | FastAPI ejecutable. Solicitudes de conexión | `.` | `backend/services/match-conexion-service/Dockerfile` | 8000 fijo. GET `/health` en loopback. |
| Convivencia/Mensajería | FastAPI ejecutable para incorporación y consultas de arriendo. Mensajería queda pendiente | `.` | `backend/services/convivencia-mensajeria-service/Dockerfile` | 8000 fijo. GET `/health` en loopback. Su ciclo de arranque incluye recuperación. |
| Reputación/Historial/Reportes | Pendiente de servicio ejecutable | — | — | — |
| Next.js | Imagen de desarrollo local | `.` | `frontend-next/Dockerfile.local` | 3000. Sin HEALTHCHECK en el Dockerfile. |

Los Dockerfiles de dominio copian `backend/service_runtime` desde el contexto común. Los healthchecks HTTP verifican que el proceso responde. La disponibilidad de Auth y SQL se comprueba por separado. Validar si Kubero usa HEALTHCHECK del contenedor o necesita configurar una sonda propia.

## Configuración y dependencias

**PostgreSQL.** Seleccionar `ROOMIES_RUNTIME_MODE=kubero` sin `ROOMIES_LOCAL_MODE=1`. Configurar `ROOMIES_KUBERO_DB_HOST`, `ROOMIES_KUBERO_DB_PORT`, `ROOMIES_KUBERO_DB_NAME` y `ROOMIES_KUBERO_DB_SSLROOTCERT` con el destino autorizado y una ruta absoluta a la CA montada. El DSN de cada proceso debe concordar con el destino, el rol esperado y la ruta de la CA. Entregar DSN y credenciales por el mecanismo de secretos de la plataforma.

| Variable del DSN | Rol de ejecución | Esquema en `private-v1` |
|---|---|---|
| `AUTH_USERS_DATABASE_URL` | `sql_auth_users` | `auth_users` |
| `LISTADO_DATABASE_URL` | `sql_listado_applications` | `listado_applications` |
| `MATCH_DATABASE_URL` | `sql_match_conexion` | `match_conexion` |
| `CONVIVENCIA_DATABASE_URL` | `sql_convivencia_mensajeria` | `convivencia_mensajeria` |

El DSN usa un único nombre DNS, puerto explícito, base y contraseña codificada para URI. `ROOMIES_KUBERO_DB_HOST` y el host del DSN deben coincidir exactamente. La política admite el formato de un Service de Kubernetes, por ejemplo `roomies-db.roomies-test.svc.cluster.local`, con el dominio real del clúster. También admite el formato corto `roomies-db` cuando el DNS del proceso cliente lo resuelve. Usar el nombre autorizado para la etapa y comprobar desde el host real de FastAPI que resuelve al servicio de PostgreSQL previsto. Los nombres de ejemplo solo ilustran el formato. [DNS de Services en Kubernetes](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/).

La política predeterminada de Kubero usa `DB_SSLMODE=verify-full` cuando la variable está ausente. En ese caso, la consulta del DSN admite exactamente `sslmode=verify-full`, `sslrootcert` y `gssencmode=disable`. La política rechaza parámetros adicionales, repetidos, `PGHOSTADDR` y `PGSERVICE`. El validador comprueba la sintaxis del destino y que el archivo indicado existe. Al conectar, libpq exige TLS y verifica la cadena de confianza y el nombre exacto que usa el cliente. La instancia de ensayo tiene `ssl=off`: la conexión con TLS sigue bloqueada hasta que la administración de Kubero habilite TLS, provea un certificado que cubra el nombre usado por el cliente y distribuya la CA. La conexión debe comprobarse con `verify-full` desde la red de cada proceso. [Verificación TLS en libpq](https://www.postgresql.org/docs/17/libpq-ssl.html).

**Excepción explícita para ensayos SQL sin TLS en Kubero TEST.** El validador compartido permite `DB_SSLMODE=disable` únicamente con todas estas variables y valores exactos:

| Variable | Valor requerido para la excepción |
|---|---|
| `ROOMIES_RUNTIME_MODE` | `kubero` |
| `ROOMIES_DEPLOYMENT_ENV` | `test` |
| `ROOMIES_KUBERO_ALLOW_INSECURE_TEST_DB` | `true` |
| `DB_SSLMODE` | `disable` |
| `ROOMIES_KUBERO_DB_HOST` | `roomies-db-test2-postgres` |
| `ROOMIES_KUBERO_DB_PORT` | `5432` |
| `ROOMIES_KUBERO_DB_NAME` | `roomies-db-test2` |

El DSN propio de cada servicio debe coincidir con ese destino, mantener su rol y credencial válidos y contener exactamente `sslmode=disable` y `gssencmode=disable`, sin `sslrootcert`. En esta excepción no se requiere `ROOMIES_KUBERO_DB_SSLROOTCERT`. El nombre de base con guiones `roomies-db-test2` solo se admite dentro de la excepción; fuera de ella se mantiene la regla general `[a-z_][a-z0-9_]{0,62}`. No se admiten otros destinos, ni siquiera el FQDN equivalente al host corto. Se conservan los controles de parámetros duplicados, roles, credenciales y overrides peligrosos. Siguen siendo necesarios el proyecto Supabase y la configuración de identidad existente, sin `ROOMIES_LOCAL_MODE=1`.

El validador devuelve el DSN original: no lo reconstruye, no corrige discrepancias con `DB_SSLMODE` y no implementa fallback si falla TLS. En modo Kubero, un valor de `DB_SSLMODE` vacío o distinto de `verify-full` y `disable` se rechaza; `disable` se rechaza si falta cualquier condición de la excepción. Los modos `supabase` y `disposable` mantienen sus políticas previas y no utilizan este selector.

Esta excepción permite ensayos SQL **sin cifrado ni verificación criptográfica del servidor**; no acredita TLS ni completa SCRUM-100. El equipo confirmó su aprobación y su validación real desde Match el 23 de noviembre de 2026, según la evidencia anterior. La etapa se declara mediante variables: en producción deben excluirse la autorización de la excepción y el acceso de red a la base TEST para evitar que una copia accidental de toda la configuración la habilite. La resolución del nombre corto depende del namespace del consumidor: quedó comprobada desde Match y sigue pendiente desde los demás consumidores previstos.

Listado, Match y Convivencia usan `database_url()` en sus repositorios. Auth/Users también lo usa en `PostgresUsers`, pero su selección actual de perfiles en modo `kubero` sigue pasando por `PostgresDatabaseSettings` y `PostgresProfileRepository`, que tienen configuración propia y rechazan `sslmode=disable` en staging. Este cambio no modifica esos adaptadores ni habilita las rutas extendidas de Auth/Users. Por tanto, aceptar el DSN compartido no demuestra integración funcional de todos los microservicios.

**Identidad.** Configurar `ROOMIES_SUPABASE_PROJECT_REF` y `ROOMIES_AUTH_PROVIDER_URL` para el mismo proyecto. Si se fija `ROOMIES_JWT_ISSUER`, debe ser el origen seleccionado seguido de `/auth/v1`. Auth/Users también tiene configuración propia de Supabase (`SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, audiencia `authenticated`, algoritmos `ES256,RS256`) y usa `ROOMIES_AUTH_PUBLISHABLE_KEY` en el flujo compartido. El PostgreSQL de negocio queda en Kubero.

**Red y código de integración.** Configurar `AUTH_USERS_UPSTREAM_URL`, `LISTADO_UPSTREAM_URL`, `MATCH_UPSTREAM_URL` y `CONVIVENCIA_UPSTREAM_URL` donde corresponda. Proveer `ROOMIES_INTERNAL_TOKEN` a los emisores y receptores de llamadas que lo requieren. El Gateway refleja el origen en el preflight de las rutas locales. Acordar los orígenes permitidos para el ingreso público antes de habilitar el recorrido. Para Next.js fijar `FASTAPI_ORIGIN`, `WEB_AUTH_FASTAPI_ORIGIN`, `WEB_AUTH_ORIGIN`, `WEB_AUTH_ENABLED`, `WEB_AUTH_PROVIDER`, `WEB_SUPABASE_ORIGIN` y `WEB_SUPABASE_PUBLISHABLE_KEY` según el entorno web. Expo debe usar el Gateway HTTPS y el mismo proyecto de identidad.

La preparación SQL no habilita el recorrido integrado. El Gateway y el arranque de Auth/Users seleccionan sus rutas por modo y todavía necesitan reconocer `kubero`. La validación HTTP compartida aún admite nombres de la topología local. Match espera `listado`, mientras Compose configura `listado-applications`. Las pruebas del Gateway esperan `GET /api/arriendos/mio` y `GET /api/arriendos/{id}`, ausentes en su tabla de rutas en la base. Coordinar la provisión de roles y esquemas con la migración de SCRUM-101. Coordinar las rutas, el despliegue y las pruebas del recorrido F01 con SCRUM-102 y los responsables de cada servicio. El bootstrap local no provee Convivencia. Para imágenes en Auth/Users y Listado, definir la persistencia de `ROOMIES_IMAGE_DIR` y comprobar los permisos de escritura del contenedor.

## Matriz de validación en Kubero

| Validación | Evidencia en la etapa `test` | Criterio de aceptación | Estado |
|---|---|---|---|
| DNS y HTTPS público | El [`/health` del Gateway](https://roomies-gateway-test.inf.uct.cl/health) devolvió **HTTP 200** con `{"status":"ok"}` el 22 de noviembre de 2026. El 24 de noviembre devolvió el mismo JSON por HTTPS desde un PC de Temuco. | DNS correcto, certificado y cadena válidos, HTTP 200 con el JSON esperado desde un cliente externo al clúster. | **Parcial.** Respuesta pública comprobada desde Temuco. Falta registrar la validación del certificado y su cadena. |
| Conectividad privada | El equipo comprobó TCP al puerto `5432` y conectividad desde Match al Service `roomies-db-test2-postgres`. El ayudante informó que la base es interna y que la plataforma administra el aislamiento entre proyectos. | DNS y puerto accesibles por los consumidores previstos. Healthchecks accesibles desde el Gateway. Servicios y SQL carecen de entrada pública. | **Parcial.** Quedan por verificar los demás consumidores y las reglas de ingreso y aislamiento que se exijan para el cierre. |
| Match → PostgreSQL con excepción TEST | El 23 de noviembre de 2026 el equipo comprobó la conexión de `roomies-match-test`, imagen `sha-72e4bd6`, Pod listo `1/1`, mediante `PostgresConnections().connect()`. Obtuvo `sql_match_conexion`, base `roomies-db-test2`, puerto `5432` y `ssl=False`. El 24, el ayudante reportó continuidad de Match tras reiniciar PostgreSQL. | Destino, rol y estado de cifrado esperados desde el contenedor real, con excepción TEST explícitamente autorizada. | **Comprobado por el equipo** para la conexión y las consultas de metadatos de solo lectura sin TLS. La continuidad posterior al reinicio se basa en el reporte del ayudante. El recorrido HTTP de negocio queda pendiente. |
| Lectura y escritura SQL de ensayo | Lectura y escritura comprobadas con la tabla `prueba_persistencia_scrum100` en la base de ensayo. El 22 de noviembre de 2026 sigue existiendo el registro de `public.prueba_persistencia_scrum100` con `id=1` y `mensaje='Roomies SCRUM-100'`. | Escribir y recuperar un registro en la tabla de ensayo. | **Comprobado** para la sonda SQL. El recorrido de escritura y lectura desde clientes a través de FastAPI queda pendiente. |
| Roles SQL limitados | `roomies_lector_test` se autenticó correctamente. Se permitió `SELECT` y se denegó `INSERT`. Para `sql_match_conexion` se comprobaron los atributos del rol, los permisos sobre la base, `public` y la tabla de ensayo, y la ausencia de membresías directas. | Desde la red de cada servicio, verificar su rol y sus permisos efectivos. Los roles de ejecución carecen de privilegios de superusuario, creación de roles o bases y propiedad de objetos del dominio. | **Parcial.** Comprobado para los permisos registrados de Match en TEST. Falta validar los roles de ejecución sobre las tablas de cada dominio. |
| TLS de PostgreSQL | El equipo observó `ssl=off` y una sesión de Match con `ssl=False`. El ayudante confirmó que la instalación actual carece de habilitación TLS para PostgreSQL del complemento. | Conexión desde la red de cada servicio con `verify-full`, CA válida y certificado que cubra el DNS usado. | **Bloqueado por la plataforma.** El cliente conserva `verify-full` como política predeterminada. La excepción TEST cubre únicamente el ensayo sin cifrado. |
| Aislamiento de esquemas | Se denegaron `SELECT` e `INSERT` a Match en la tabla de ensayo de `public`. Las tablas de los dominios aún no se han migrado y sus roles respectivos quedan por configurar. | Lectura propia permitida, acceso cruzado denegado y rol de migraciones separado. | **Pendiente.** |
| Persistencia | El equipo registró `data_directory=/var/lib/postgresql/data/pgdata`, `fsync=on` y persistencia declarada en el YAML. El 24 de noviembre el ayudante confirmó el volumen persistente de 8 GiB y reportó que el reinicio controlado conservó el mismo volumen y el registro. | El dato reaparece desde el volumen previsto tras un reinicio y un reemplazo controlados. Se documenta la política de retención y se repite con imágenes si aplica. | **Reinicio confirmado por el ayudante.** Sigue pendiente la verificación directa del PVC y su retención. El reemplazo diferenciado del Pod queda sin acreditar. |
| Respaldo y restauración | El equipo recuperó el registro de ensayo en `roomies_restore_scrum100_24nov` y lo comprobó también en origen. El ayudante informó que generó el archivo `roomies-db-test2.dump` antes del reinicio. | Restauración reproducible con acceso acotado. Datos, esquemas y permisos comprobados, con alcance, retención y tiempos documentados. | **Parcial.** Recuperación del registro comprobada con el respaldo del equipo. Faltan verificar una copia externa duradera, los permisos efectivos y el alcance operativo. |
| Next.js y Expo | Pendiente probar inicio de sesión, petición autenticada y rechazo sin JWT desde web, Expo nativo y Expo Web, con preflight donde aplique. | Los clientes usan Gateway HTTPS y el mismo emisor, y completan los flujos acordados. | **Pendiente de integración.** |

## Primer ensayo de FastAPI y PostgreSQL en una etapa aislada

Usar este procedimiento para repetir las comprobaciones y completar los puntos pendientes cuando se autorice operar en Kubero.

1. Confirmar etapa aislada, dominio de ingreso, procedimiento de publicación de imágenes y acceso a logs con el equipo de Kubero. Registrar etapa, SHA de la imagen y fecha. Construir el Gateway con contexto `backend/api-gateway` y publicar solo el ingreso HTTPS de esa imagen, sin configuración SQL. Consultar `https://<gateway-de-ensayo>/health` desde un cliente externo al clúster con verificación normal del certificado. Esperar HTTP 200 y `{"status":"ok"}`.
2. Obtener una instancia PostgreSQL de ensayo con DNS privado, puerto, base, rol de prueba de privilegios mínimos y credencial entregada como secreto. Confirmar TLS, SAN y CA. Ejecutar una sonda SQL independiente desde la red privada de esa etapa. Usar un cliente PostgreSQL compatible y fijar `sslmode=verify-full`, la CA y `gssencmode=disable` con un tiempo límite de conexión. Con una transacción de solo lectura, ejecutar:

   ```sql
   BEGIN READ ONLY;
   SELECT current_user, current_database();
   SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();
   ROLLBACK;
   ```

   Confirmar rol y base esperados y `ssl = true`. Si la conexión falla, registrar si falló DNS, TCP, TLS o autenticación usando salidas sanitizadas. La sonda no requiere aplicar migraciones ni arrancar Convivencia. Pasar a las pruebas por dominio con TLS únicamente después de verificarlo y disponer de esquemas de ensayo provisionados. Si se autoriza por separado el ensayo sin TLS, usar exclusivamente la excepción TEST documentada arriba y registrar `ssl = false` como conexión sin cifrado, nunca como validación TLS. No reintentar automáticamente con `disable` tras un fallo de TLS.
3. Registrar resultados y pendientes en SCRUM-100 con etapa, SHA, verificación ejecutada y evidencia sanitizada. Programar los ensayos de reinicio, reemplazo y restauración por separado en recursos desechables.

## Procedimiento de referencia para verificar persistencia y reemplazo

El equipo dejó preparado este procedimiento. El reinicio reportado por el ayudante se registra arriba con la evidencia recibida. Los pasos siguientes sirven para completar la trazabilidad del volumen y comprobar un reemplazo por separado si el alcance de cierre lo exige.

1. Acordar con la administración un recurso PostgreSQL TEST aislado, ventana de interrupción, responsable, respaldo recuperable y plan de recuperación. Identificar el controlador del Pod, namespace, UID del Pod, contenedor PostgreSQL, PVC/PV, montaje y política de retención. No operar si no se puede identificar inequívocamente el PostgreSQL objetivo; la opción «Reiniciar» de la aplicación no basta.
2. Antes de la intervención, consultar y registrar el contenido existente de `public.prueba_persistencia_scrum100` (`id=1`, `mensaje='Roomies SCRUM-100'`), junto con `current_database()`, `pg_postmaster_start_time()` y `SHOW data_directory`. Usar un rol autorizado para esa tabla: la conexión de Match no demuestra que tenga permiso para leerla. No crear tablas ni aplicar migraciones. Confirmar que el dato está confirmado y presente antes del evento; guardar fecha y evidencia sanitizada.
3. Solicitar primero un reinicio controlado del proceso/contenedor PostgreSQL mediante un mecanismo identificado por la administración. No reiniciar solo Match o la aplicación auxiliar. Esperar disponibilidad y volver a consultar el registro. Comparar hora de arranque, identidad del contenedor y volumen; documentar el evento y el resultado. La hora de arranque por sí sola no identifica un reemplazo de Pod.
4. En un ensayo separado, solicitar el reemplazo controlado del Pod PostgreSQL por su controlador, conservando el PVC/PV. No eliminar el complemento, la aplicación de base de datos, el StatefulSet ni los volúmenes, ni cambiar simultáneamente versión o configuración. Exigir evidencia del cambio de UID del Pod y de la continuidad del volumen antes de considerar realizado el reemplazo.
5. Tras cada evento, repetir las consultas del paso 2 y la sonda de conexión desde Match, comparar exactamente el registro y el montaje y registrar tiempos de indisponibilidad. Si el dato falta o cambia el volumen, detener el ensayo, conservar evidencia y activar la recuperación acordada; no reinsertar el registro para simular persistencia.
6. Registrar por separado reinicio y reemplazo como aprobados o fallidos, con antes/después, responsable, fecha, recurso y resultado. Documentar retención de volúmenes y respaldos. Si se evalúan imágenes, repetir su comprobación en el almacenamiento correspondiente. Ningún paso de este procedimiento se ejecutó durante esta actualización documental.

## Alcance, pendientes y criterio de cierre de SCRUM-100

Las fuentes disponibles son el [anexo técnico de SCRUM-99, §15 y §21](../SCRUM-99-anexo-tecnico.md) y la [matriz contractual, D08 y D09](../contracts/SCRUM-99-contrato-alcance-S3-v1.4.md). Identifican SCRUM-100 como **S3R-B02: validar Kubero y fijar la topología**, con PostgreSQL de negocio en Kubero, Supabase Auth separado y host de procesos decidido mediante pruebas de red y permisos. El anexo pide confirmar en Jira volumen persistente, backup, responsables y criterios de aceptación. No se encontró en el worktree el PDF original del backlog ni una aceptación final del ticket que permita reemplazar esos criterios por inferencias.

**Evidencia de B02.** El equipo comprobó el Gateway público por HTTPS, la conexión privada real de Match a PostgreSQL con un rol limitado, permisos de ese rol sobre recursos de ensayo y la recuperación de un registro desde un respaldo. El ayudante confirmó la persistencia del registro tras el reinicio controlado con el mismo volumen. Esta evidencia sustenta la viabilidad de la topología A en TEST para Gateway, Match y PostgreSQL.

**Veredicto al 24 de noviembre de 2026.** SCRUM-100 sigue en curso. Es viable proponer un cierre acotado a TEST cuando el equipo registre su aceptación y se cumplan los demás criterios de B02 que se acuerden. D08 y la síntesis local de B02 no explicitan TLS como requisito contractual original. La matriz técnica exige `verify-full` y ese criterio sigue bloqueado por la limitación de la plataforma comunicada por el ayudante. La autorización previa cubre los ensayos TEST sin cifrado. Cerrar con TLS pendiente requiere una decisión explícita del equipo y seguimiento asignado. En producción se conserva `verify-full` obligatorio.

### Decisiones del equipo para cerrar SCRUM-100

- [ ] Aprobar la topología A para TEST y acordar qué consumidores y comprobaciones de red y permisos se requieren para cerrar B02. Confirmar los responsables operativos por etapa.
- [ ] Completar la evidencia técnica de HTTPS del Gateway con el registro de validación del certificado y su cadena.
- [ ] Acordar si el reporte del reinicio y del mismo volumen basta para B02 o si se requiere inspección del PVC, evidencia de retención y una prueba separada de reemplazo.
- [ ] Acordar la custodia duradera y retención del respaldo de TEST y confirmar quién verificará la recuperación.
- [ ] Registrar si se acepta cerrar B02 con TLS pendiente para TEST. Documentar el límite de la excepción, el responsable del seguimiento y cuándo se retomará la verificación de `verify-full`.

### Entregas de SCRUM-101 y SCRUM-102

- **SCRUM-101 · S3R-B03.** Ensayar y ejecutar la migración de los datos de negocio a PostgreSQL de Kubero, preservando datos e identidades. Corresponden aquí el inventario de origen, el respaldo y plan de recuperación de la migración, y la comparación verificable antes y después.
- **SCRUM-102.** Desplegar el Gateway y los servicios de dominio separados con persistencia duradera, identificar las revisiones desplegadas y verificar la operación de cada servicio, su conectividad y sus permisos efectivos sobre las tablas de dominio. El despliegue completo y sus pruebas quedan para ese alcance.
