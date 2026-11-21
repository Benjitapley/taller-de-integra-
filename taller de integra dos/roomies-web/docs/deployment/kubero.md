# SCRUM-100 · Validación de Kubero

## Evidencia disponible

- **Observado en la auditoría previa.** En el Kubero universitario (`kubero.inf.uct.cl`), equipo `integral_IV_grupo6`, pipeline `roomies`, etapa Production, se vio la aplicación de demostración `server` (Node.js, puerto 3000). Su complemento mostraba PostgreSQL 17.6, `server-postgres:5432` y el contenedor `server-postgres-0`. Los logs mostraban recuperación automática y posterior disponibilidad para conexiones.
- **Validado localmente en SCRUM-100.** `python -m pytest backend/local_stack/test_runtime.py -q` registró **91 pruebas aprobadas**. La suite comprueba la selección de destino, la política TLS del DSN, Supabase Auth, la compatibilidad con `disposable` y `supabase` y el cifrado y descifrado DPAPI de bytes sintéticos. Estas pruebas no abren conexiones SQL ni HTTP. La [evidencia histórica de Convivencia](../contracts/incorporacion.evidencia.md) registra pruebas SQL contra PostgreSQL desechable local, con identidad y Listado simulados.
- **Validado en Kubero.** El ensayo se realizó en el pipeline `roomies`, etapa `test`, separado de la aplicación de demostración en Production. PostgreSQL 17.6 está desplegado en `roomies-db-test2`, con el Service DNS interno `roomies-db-test2-postgres`. La base de ensayo `roomies-db-test2` se creó manualmente. La matriz registra el alcance de la sonda SQL, el respaldo y la restauración, y la respuesta pública del Gateway.

SCRUM-100 sigue en curso. La migración de datos históricos de S3R-B03 queda pendiente de ejecución y comparación antes/después.

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

La consulta del DSN admite exactamente `sslmode=verify-full`, `sslrootcert` y `gssencmode=disable`. La política rechaza parámetros adicionales, repetidos, `PGHOSTADDR` y `PGSERVICE`. El validador comprueba la sintaxis del destino y que el archivo indicado existe. Al conectar, libpq exige TLS y verifica la cadena de confianza y el nombre exacto que usa el cliente. La instancia de ensayo tiene `ssl=off`. La activación SQL del runtime en modo `kubero` queda bloqueada hasta que la administración de Kubero habilite TLS, provea un certificado que cubra el nombre usado por el cliente y distribuya la CA. La conexión debe comprobarse con `verify-full` desde la red de cada proceso. [Verificación TLS en libpq](https://www.postgresql.org/docs/17/libpq-ssl.html).

**Identidad.** Configurar `ROOMIES_SUPABASE_PROJECT_REF` y `ROOMIES_AUTH_PROVIDER_URL` para el mismo proyecto. Si se fija `ROOMIES_JWT_ISSUER`, debe ser el origen seleccionado seguido de `/auth/v1`. Auth/Users también tiene configuración propia de Supabase (`SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, audiencia `authenticated`, algoritmos `ES256,RS256`) y usa `ROOMIES_AUTH_PUBLISHABLE_KEY` en el flujo compartido. El PostgreSQL de negocio queda en Kubero.

**Red y código de integración.** Configurar `AUTH_USERS_UPSTREAM_URL`, `LISTADO_UPSTREAM_URL`, `MATCH_UPSTREAM_URL` y `CONVIVENCIA_UPSTREAM_URL` donde corresponda. Proveer `ROOMIES_INTERNAL_TOKEN` a los emisores y receptores de llamadas que lo requieren. El Gateway refleja el origen en el preflight de las rutas locales. Acordar los orígenes permitidos para el ingreso público antes de habilitar el recorrido. Para Next.js fijar `FASTAPI_ORIGIN`, `WEB_AUTH_FASTAPI_ORIGIN`, `WEB_AUTH_ORIGIN`, `WEB_AUTH_ENABLED`, `WEB_AUTH_PROVIDER`, `WEB_SUPABASE_ORIGIN` y `WEB_SUPABASE_PUBLISHABLE_KEY` según el entorno web. Expo debe usar el Gateway HTTPS y el mismo proyecto de identidad.

La preparación SQL no habilita el recorrido integrado. El Gateway y el arranque de Auth/Users seleccionan sus rutas por modo y todavía necesitan reconocer `kubero`. La validación HTTP compartida aún admite nombres de la topología local. Match espera `listado`, mientras Compose configura `listado-applications`. Las pruebas del Gateway esperan `GET /api/arriendos/mio` y `GET /api/arriendos/{id}`, ausentes en su tabla de rutas en la base. Coordinar estos puntos, la provisión de roles y esquemas y el recorrido F01 con SCRUM-101 y los responsables de cada servicio. El bootstrap local no provee Convivencia. Para imágenes en Auth/Users y Listado, definir la persistencia de `ROOMIES_IMAGE_DIR` y comprobar los permisos de escritura del contenedor.

## Matriz de validación en Kubero

| Validación | Evidencia en la etapa `test` | Criterio de aceptación | Estado |
|---|---|---|---|
| DNS y HTTPS público | El [`/health` del Gateway](https://roomies-gateway-test.inf.uct.cl/health) devolvió `{"status":"ok"}` por HTTPS. | DNS correcto, certificado y cadena válidos, HTTP 200 con JSON esperado desde fuera y desde el equipo de presentación. | **Parcial.** Respuesta pública comprobada. Falta documentar el código HTTP y la validación del certificado y repetir desde el equipo de presentación. |
| Conectividad privada | Service DNS `roomies-db-test2-postgres` identificado y conectividad TCP al puerto `5432` comprobada. | DNS y puerto accesibles por los consumidores previstos. Healthchecks accesibles desde el Gateway. Servicios y SQL carecen de entrada pública. | **Parcial.** Falta verificar la conectividad desde cada consumidor y las reglas de ingreso. |
| Lectura y escritura SQL de ensayo | Lectura y escritura comprobadas con la tabla `prueba_persistencia_scrum100` en la base de ensayo. | Escribir y recuperar un registro en la tabla de ensayo. | **Comprobado** para la sonda SQL. El recorrido de escritura y lectura desde clientes a través de FastAPI queda pendiente. |
| Roles SQL limitados | `roomies_lector_test` se autenticó correctamente. Se permitió `SELECT` y se denegó `INSERT`. | Desde la red de cada servicio, verificar su rol y sus permisos efectivos. Los roles de ejecución carecen de privilegios de superusuario, creación de roles o bases y propiedad de objetos del dominio. | **Parcial.** Comprobado para el rol lector de ensayo. Faltan los roles de ejecución y sus permisos por dominio. |
| TLS de PostgreSQL | La instancia de ensayo tiene `ssl=off`. | Conexión desde la red de cada servicio con `verify-full`, CA válida y certificado que cubra el DNS usado. | **Bloqueado** hasta habilitar y verificar TLS. |
| Aislamiento de esquemas | Pendiente comprobar privilegios efectivos y membresías, consultar tablas propias e intentar una lectura de otro dominio. | Lectura propia permitida, acceso cruzado denegado y rol de migraciones separado. | **Pendiente.** |
| Persistencia | `data_directory=/var/lib/postgresql/data/pgdata` y `fsync=on`. | El dato reaparece desde el volumen previsto tras un reinicio y un reemplazo controlados. Se documenta la política de retención y se repite con imágenes si aplica. | **Pendiente.** La configuración observada queda como evidencia de la instancia. Falta probar el volumen y recuperar el dato tras reinicio y reemplazo. |
| Respaldo y restauración | Respaldo con `pg_dump`, restauración con `pg_restore` en `roomies_restore_test` y registro recuperado. | Restauración reproducible con acceso acotado. Datos, esquemas y permisos comprobados, con alcance, retención y tiempos documentados. | **Parcial.** Ensayo puntual de respaldo y restauración comprobado. Falta validar el alcance operativo y los permisos. |
| Next.js y Expo | Pendiente probar inicio de sesión, petición autenticada y rechazo sin JWT desde web, Expo nativo y Expo Web, con preflight donde aplique. | Los clientes usan Gateway HTTPS y el mismo emisor. Los flujos acordados pasan desde la red de presentación. | **Pendiente.** |

## Primer ensayo de FastAPI y PostgreSQL en una etapa aislada

Usar este procedimiento para repetir las comprobaciones y completar los puntos pendientes cuando se autorice operar en Kubero.

1. Confirmar etapa aislada, dominio de ingreso, procedimiento de publicación de imágenes y acceso a logs con el equipo de Kubero. Registrar etapa, SHA de la imagen y fecha. Construir el Gateway con contexto `backend/api-gateway` y publicar solo el ingreso HTTPS de esa imagen, sin configuración SQL. Consultar `https://<gateway-de-ensayo>/health` desde la red de presentación con verificación normal del certificado. Esperar HTTP 200 y `{"status":"ok"}`.
2. Obtener una instancia PostgreSQL de ensayo con DNS privado, puerto, base, rol de prueba de privilegios mínimos y credencial entregada como secreto. Confirmar TLS, SAN y CA. Ejecutar una sonda SQL independiente desde la red privada de esa etapa. Usar un cliente PostgreSQL compatible y fijar `sslmode=verify-full`, la CA y `gssencmode=disable` con un tiempo límite de conexión. Con una transacción de solo lectura, ejecutar:

   ```sql
   BEGIN READ ONLY;
   SELECT current_user, current_database();
   SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();
   ROLLBACK;
   ```

   Confirmar rol y base esperados y `ssl = true`. Si la conexión falla, registrar si falló DNS, TCP, TLS o autenticación usando salidas sanitizadas. La sonda no requiere aplicar migraciones ni arrancar Convivencia. Pasar a las pruebas por dominio únicamente después de verificar TLS y disponer de esquemas de ensayo provisionados.
3. Registrar resultados y pendientes en SCRUM-100 con etapa, SHA, verificación ejecutada y evidencia sanitizada. Programar los ensayos de reinicio, reemplazo y restauración por separado en recursos desechables.
