# Evidencia S3R-E05 / SCRUM-122

Revision: 26/11/2026, America/Santiago. Fuente: Roomies_Backlog_TI2_Sprint3_v1.4.pdf, paginas 29-30; dependencias F03 y decisiones D02/D05 en paginas 5 y 32.

Base: `52ef5fd144232ebc4df50616cf3da4e37699292b`, rama `SCRUM-122-Conectar-retiro-por-arrendador-y-revocar-la-experiencia-activa`, cambios locales sin commit. [Jira SCRUM-122](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-122). PR pendiente. El [manifest SHA-256](sources-sha256.txt) identifica las fuentes revisadas, incluidos los nuevos escenarios.

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
