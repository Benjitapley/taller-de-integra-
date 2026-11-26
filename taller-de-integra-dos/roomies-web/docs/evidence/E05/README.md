# Evidencia S3R-E05 / SCRUM-122

Revision: 26/11/2026, America/Santiago. Fuente: Roomies_Backlog_TI2_Sprint3_v1.4.pdf, paginas 29-30; dependencias F03 y decisiones D02/D05 en paginas 5 y 32.

Revision inicial basada en `52ef5fd144232ebc4df50616cf3da4e37699292b`, registrada en `51374ae`, rama `SCRUM-122-Conectar-retiro-por-arrendador-y-revocar-la-experiencia-activa`. [Jira SCRUM-122](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-122). El [manifest SHA-256](sources-sha256.txt) identifica las fuentes reconciliadas con `dev-web`; los resultados actualizados del merge figuran al final. Las secciones previas conservan los resultados de sus revisiones originales.

## Resultado de la revision

El retiro, la outbox, los permisos y la UI ya existian. Faltaba comprobarlos con SQL y servicios reales: la evidencia del 24/11 registraba cinco pruebas SQL omitidas por un fallo de initdb. PostgreSQL 19 arranca en esta revision y esas pruebas pasan.

El recorrido real detecto un defecto adicional: Convivencia buscaba `id_propietario` en el detalle publico canonico de Listado, que ya no devuelve ese campo. El propietario recibia 403 al consultar detalle/integrantes y no podia llegar a la accion de retiro. Se corrigio usando la API interna de propietario con credencial de servicio y el ID del actor autenticado. Dos pruebas de regresion verifican propietario/ajeno sin depender del DTO publico.

## Verificacion por criterio del backlog

| Criterio | Evidencia local |
|---|---|
| Solo dueno ve la accion; motivo y confirmacion | Chromium: accion visible al propietario y oculta al residente; formulario bloqueado hasta completar ambos campos. Gateway real: motivo vacio/blanco y confirmacion falsa/no booleana dan 422 |
| Dueno ajeno y admin no propietario reciben 403 | Servicios reales: cuenta ajena normal y cuenta con rol administrativo comprobado reciben 403 sin alterar pertenencia |
| Cupo liberado una sola vez | Dos POST concurrentes devuelven la misma respuesta, una sola fila de auditoria y ocupacion restante uno. Chromium: doble clic envia un POST y muestra un cupo disponible |
| Retirado pierde chat, historial y tareas | SQL y Gateway reales niegan lectura/envio de chat y lectura/creacion/completado de tareas; Mi arriendo devuelve 404. Chromium desmonta tareas, mensajes y borrador; recargar chat sigue denegado y Mi arriendo elimina enlaces activos |
| Pendientes quedan reasignables | SQL y Gateway: pendiente queda sin asignado, otro integrante la reasigna/completa; completada conserva asignado e historia |
| Responsable vacante | Retiro del primero deja `id_responsable=null`; el otro integrante puede gestionar tareas |
| Ultimo integrante finaliza y cierra sin reabrir | Carrera con mensaje/completado; arriendo Finalizado, aviso Cerrada y ocupacion cero. Reiniciar Listado/Convivencia conserva el resultado; un evento de ocupacion antiguo no reabre ni cambia la ocupacion |
| Recuperacion de eventos | Se fuerza 503 del transporte de ocupacion, el retiro local sigue revocado, se reinicia Convivencia y se restaura Listado. Worker drena outbox; Auth/Users persiste un unico aviso por retiro |

## Comprobaciones ejecutadas

| Comprobacion | Resultado | Alcance |
|---|---|---|
| Suite Convivencia | 94 passed, 0 skipped | PostgreSQL real, migraciones 001-006 y rol dedicado; puertos de dependencias simulados en la suite |
| Recorrido E05 integrado | PASS | Gateway, Auth/Users, Listado y Convivencia en procesos separados; SQL, HTTP interno, avisos y worker reales |
| Gateway | 185 passed | Regresiones de enrutamiento y permisos de metodos con upstream simulado |
| BFF retiro/tareas/reportes | 13 passed | Sesion, CSRF, validacion, propagacion de errores y DTO con transportes simulados |
| Chromium + Next/BFF | 1 passed, 0 skipped | Formulario, doble clic, cupo liberado, ultimo retiro, ocultacion, revocacion de tareas/chat y enlaces de Mi arriendo; HTTP de negocio sintetico |
| git diff --check | exit 0 | Espacios y marcadores |

Entorno: Windows/PowerShell; Python 3.14.7, PostgreSQL 19.0, Node v24.20.0, Next 16.4.3, Chromium 1255. Una advertencia de deprecacion Starlette/httpx en Convivencia, sin fallos. No hubo cambios de fuentes TypeScript de producto; se ampliaron las pruebas de navegador existentes. Los resultados de build/typecheck del 24/11 son historicos y no se presentan como nuevas ejecuciones.

El runner integrado crea y elimina su propio cluster efimero en loopback, aplica migraciones y ejecuta cada servicio con su rol SQL. Usa cuentas ficticias de `example.com`, variables sinteticas y barreras contra conexiones externas y lectura de dotenv en los servicios. El proveedor externo de identidad es un fixture HTTP con JWT/JWKS de prueba; no es una cuenta real de Supabase. La caida de red se introduce mediante un proxy local; no se modifican servicios desplegados ni datos del usuario.

## Comandos reproducibles

Desde la raiz del repositorio, usando el Python del entorno con dependencias instaladas:

```powershell
.venv/Scripts/python.exe -I -B taller-de-integra-dos/roomies-web/backend/services/convivencia-mensajeria-service/tests/run_isolated.py
# 94 passed, sin omisiones; PostgreSQL efimero.
.venv/Scripts/python.exe -I -B taller-de-integra-dos/roomies-web/tests/integration/run_c03.py --departures
# PASS E05: propietario/admin, retiro y revocacion, recuperacion y ultimo cierre.
.venv/Scripts/python.exe -I -B taller-de-integra-dos/roomies-web/backend/api-gateway/tests/run_isolated.py
# 185 passed.
```

El runner integrado acepta `--pg-bin` si PostgreSQL no esta en PATH ni en su ubicacion habitual de Windows. El runner de Convivencia acepta `POSTGRES_BIN`.

Desde `frontend-next`:

```powershell
node --test tests/expulsiones.test.mjs tests/tareas.test.mjs tests/reportes.test.mjs
# 13 passed.
# REPORTS_PLAYWRIGHT_PATH: ruta al paquete Playwright instalado.
# REPORTS_BROWSER_PATH: ruta al ejecutable Chromium local.
node --test tests/expulsiones-browser.test.mjs
# 1 passed; verificar que skipped sea 0.
```

Las variables de Playwright son obligatorias para ejecutar la prueba de navegador; sin ellas se omite y no cuenta como evidencia.

## Capturas sanitizadas

- [Confirmacion con motivo y checkbox](01-confirmacion-retiro.png).
- [Tareas desmontadas tras perdida de membresia](02-acceso-revocado.png).
- [Chat desmontado tras perdida de membresia](03-chat-revocado.png).

Las capturas proceden de fixtures HTTP. La persistencia se acredita por la suite SQL y el recorrido integrado, no por estas imagenes.

## Limite de aceptacion

E05 queda implementado y validado localmente. Ya no estan pendientes las cinco pruebas SQL ni el recorrido local de servicios. Para aceptar el candidato desplegado en E06/B06, aplicar las migraciones en el destino y repetir el recorrido con sus versiones, Gateway y proveedor real identificados; registrar SHA/digest y evidencia. No se ejecutaron despliegues, migraciones remotas ni pruebas en Expo/celular fisico en esta revision. Jira y PR siguen sin actualizarse.

## Integración con SCRUM-123 · 25/11/2026

Se reconcilió `9c9ab5e` con `dev-web` en `d934a97`, que ya contiene SCRUM-122 y E04. Se conserva el contrato de retiro y tareas integrado en `dev-web`, incluido el formulario `RemoveMember`, la paginación y la comprobación periódica de pertenencia. Las implementaciones alternativas de servicio, BFF y pantalla de tareas se retiraron para evitar rutas y modelos duplicados. Sus commits siguen en el historial.

La secuencia de migración vigente es `001`–`004`, [005_retiro.up.sql](../../../backend/services/convivencia-mensajeria-service/migrations/005_retiro.up.sql) y [006_tareas_reasignables.up.sql](../../../backend/services/convivencia-mensajeria-service/migrations/006_tareas_reasignables.up.sql). Se retiró `005_retiros.up.sql`, que creaba las mismas tablas con un esquema incompatible. Esta integración no aplica migraciones sobre bases compartidas.

Se conserva el control de pertenencia móvil de SCRUM-123: consulta real al entrar/regresar a la app, desmontaje de pantallas privadas y vaciado del almacén tras una denegación. También se conserva el enlace de postulantes aceptados a la gestión de integrantes.

Validación de la integración: Convivencia, 92 pruebas aprobadas con PostgreSQL efímero y migraciones 001–006; Gateway, 185 aprobadas; Listado, 4 pruebas de proyección de retiro aprobadas; web/BFF y regresiones HTTP, 58 aprobadas; convivencia móvil, 12 aprobadas. Typecheck y lint web pasaron. Los resultados y el manifiesto de la sección anterior describen la revisión histórica de SCRUM-122, no certifican por sí solos este merge.

La prueba adicional `npm.cmd run test:convivencia-browser` pasó (1 prueba) con Next/BFF reales y Edge con API sintética, sin Playwright ni cuentas reales; reproduce confirmación, doble clic, respuesta perdida, ausencia de acción para quien no es dueño y revocación de tareas. `E05_QA_DIR` permite regenerar las capturas complementarias [escritorio](retiro-confirmacion.png) y [ancho móvil web](retiro-confirmacion-mobile.png). La aceptación en despliegue y celular físico continúa pendiente.

## Merge de SCRUM-122 con dev-web · 26/11/2026

Se integra `origin/dev-web` en `99577b4` sobre `51374ae`, conservando el historial de ambas ramas. Los conflictos eran dos capturas, este documento y el fixture de navegador. Se conservan las secciones de evidencia de ambas revisiones y se regeneran las tres capturas de E05 con el frontend reconciliado.

La prueba ampliada mantiene retiro parcial/ultimo, doble clic, revocacion de tareas/chat/borrador y enlaces de Mi arriendo; incorpora `id_usuario_actual` requerido por el contrato actual de tareas de E04. Se conserva la nueva pantalla de tareas, el hook compartido de pertenencia, las migraciones y las adaptaciones de Convivencia de `dev-web`, junto con la verificacion de propietario por API interna de SCRUM-122.

Validacion posterior a resolver los conflictos:

- Convivencia: **123 passed**, sin omisiones, PostgreSQL efimero y todas las migraciones `*.up.sql` actuales, incluidas las de compatibilidad hasta `007_expulsiones.up.sql`.
- Gateway: **191 passed**.
- BFF y navegador: **17 passed**, sin omisiones; comando anterior ampliado con `tests/tareas-contract.test.mjs` y `tests/expulsiones-browser.test.mjs`, con Chromium configurado.
- `run_c03.py --departures`: **PASS**, cuatro servicios y SQL reales; permisos, concurrencia, revocacion, reasignacion, cierre, reinicios y evento antiguo.
- `npm.cmd run typecheck` y `npm.cmd run lint`: **exit 0** con Next 16.4.6.
- `node tests/build-isolated.mjs`: **exit 0**, compilacion de produccion sin dotenv ni red externa. Next informa la advertencia existente de multiples lockfiles.

El proveedor externo de identidad sigue siendo un fixture local. Esta validacion no aplica migraciones en destinos compartidos ni acredita aceptacion en despliegue o celular fisico.
