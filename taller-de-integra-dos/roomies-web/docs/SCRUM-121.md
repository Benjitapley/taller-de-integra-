# S3R-E04 · Tareas compartidas y prueba cruzada

**Corte:** 24/11/2026, entorno local de desarrollo. **Jira:** [SCRUM-121](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-121). **Rama:** `SCRUM-121-Conectar-tareas-compartidas-y-prueba-cruzada`. **SHA base:** `6c859136405866d270d7bbb0511c9ca0fc5b519d`; los cambios de esta tarea están sin commit, por lo que ese SHA no los identifica. **PR:** pendiente.

## Implementado en código

- Convivencia persiste tareas mediante migración `005_tareas.up.sql`; permite crear, listar por estado con cursor ligado al actor y arriendo, reasignar pendientes a integrantes activos y completar solo por el asignado activo. La creación valida asignado activo y la baja de pertenencia desasigna tareas pendientes. Un retirado recibe 403 en operaciones de tareas.
- Gateway reenvía las rutas públicas del contrato. BFF usa la sesión de la web, valida campos, aplica protección de origen/CSRF para escrituras, conserva 403/422 y limita los datos de respuesta.
- La vista `/mi-arriendo/tareas` usa datos de API, filtros Pendiente/Completada, paginación, miembros activos, creación, reasignación, completado, carga y errores. No actualiza estado de forma optimista: si PATCH falla, mantiene la lista anterior. Al volver a la pestaña consulta tareas y miembros otra vez.
- La API de integrantes de Convivencia expone IDs activos y fechas de ingreso; aún no hay fuente de nombres para otros miembros, por lo que la web usa «Integrante #ID» cuando `nombre` es nulo.
- El cliente Expo local consulta el mismo Gateway para conocer el arriendo actual y listar tareas por estado con cursor. Permite completar solo las asignadas al usuario actual y vuelve a consultar tras el PATCH. Un fallo deja la tarea sin cambios visibles y muestra el error. El dashboard Arriendo vuelve a mostrar cuatro tarjetas compactas de tareas pendientes, inspiradas en el mockup y alimentadas por la API; el contrato no incluye fecha, por lo que muestra estado/asignación. Se ajustaron además las tarjetas de lugar y recordatorios al color y disposición del mockup. La lista ya no repite el título de la cabecera.

## Validación local sanitizada

Entorno: Windows PowerShell, Python 3.14, Node 24, Next 16.4.3. Se instaló PyJWT/cryptography en una carpeta temporal para ejecutar la prueba HTTP, sin modificar el entorno de despliegue.

```text
python -m compileall -q backend/services/convivencia-mensajeria-service/app backend/api-gateway/app
# exit 0
$env:PYTHONPATH="$env:TEMP\roomies-s3r-e04-python;"+(Get-Location).Path+';'+(Resolve-Path backend/services/convivencia-mensajeria-service).Path
$env:ROOMIES_INTERNAL_TOKEN='isolated-test-service-key-000000000000'
python -m pytest -q backend/services/convivencia-mensajeria-service/tests/test_http.py
# 26 passed, 1 warning de deprecación Starlette
$env:PYTHONPATH=(Resolve-Path backend/api-gateway).Path
python -m pytest -q backend/api-gateway/tests/test_convivencia_routes.py -k tareas_se_enrutan
# 5 passed, 19 deselected
node --test frontend-next/tests/tareas.test.mjs
# 2 passed
node frontend-next/node_modules/next/dist/bin/next typegen
# exit 0
node frontend-next/node_modules/typescript/bin/tsc --noEmit
# exit 0
node frontend-next/node_modules/eslint/bin/eslint.js [archivos modificados]
# exit 0
node node_modules/typescript/bin/tsc --noEmit
# exit 0, ejecutado en roomies-app-movil
node node_modules/expo/bin/cli lint
# exit 0, ejecutado en roomies-app-movil
node --test tests/tareasService.test.mjs
# 2 passed, ejecutado en roomies-app-movil
git diff --check
# exit 0; advertencia de normalización LF/CRLF de Git
```

La prueba HTTP nueva comprueba rutas, validación estricta, 403 de actor no asignado/retirado y 422 de asignado inválido usando repositorio simulado. La prueba del BFF comprueba sesión, CSRF, respuesta 403 y que un PATCH 503 no devuelve una tarea completada. La prueba móvil comprueba las rutas/contrato y el rechazo de respuestas inválidas y PATCH fallido con transporte simulado. Falta ejecutar la migración y esos casos contra PostgreSQL y cuentas reales; no se atribuye a estas pruebas una demostración de persistencia o de permisos integrados.

## Dependencia TI4 y aceptación pendiente

El árbol móvil local en `taller de integra cuatro/roomies-app-movil` ya implementa el cliente de tareas de E04 sobre la API, pero conserva otros datos simulados del dashboard fuera de E04. Se comprobó con Expo SDK 57, TypeScript, lint y prueba del adaptador. El SHA base `6c859136405866d270d7bbb0511c9ca0fc5b519d` **no** identifica estos cambios sin commit ni una versión instalada en celular. `EXPO_PUBLIC_API_URL` no contiene una URL utilizable en el entorno local revisado; tampoco se detectó `adb` instalado. No se verificó Gateway desplegado, cuentas de prueba ni dispositivo físico. La asignación de quién entrega/prueba Expo sigue pendiente de confirmación por el encargado TI4; B01 conserva esa dependencia abierta.

Para aceptar E04 falta: migrar/desplegar Convivencia y Gateway; identificar sus SHA/URL y la versión Expo; ejecutar en el mismo Gateway creación web → lectura/completado en celular físico → lectura persistida en web; registrar dispositivo, cuentas sanitizadas, comandos/resultados, 403 no asignado y retirado, 422 asignado inválido y fallo de PATCH visible sin cambio. Si TI4 no entrega cliente compatible el 24, escalar el bloqueo E06/B06 ese día. Hasta entonces, estado **implementado localmente, aceptación cruzada pendiente**. No se declara cumplimiento completo de FR-71 a 74/149.
