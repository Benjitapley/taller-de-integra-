# S3R-E04 · Tareas compartidas y prueba cruzada

**Actualización:** 26/11/2026, entorno local de desarrollo. **Jira:** [SCRUM-121](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-121). **Rama:** `SCRUM-121-Conectar-tareas-compartidas-y-prueba-cruzada`. **HEAD de partida:** `593de79789c412f5c26c9922537f2fe003c439a9`; la ampliación de pruebas y las correcciones de esta revisión están sin commit. **PR:** pendiente.

La validación vigente está en [E04: resultados del 26/11](E04-validacion-local-2026-11-26.md): 79 pruebas del servicio con PostgreSQL efímero, recorrido BFF/Gateway/SQL/adaptador móvil, prueba de pantalla en navegador, build web y comprobaciones móviles aprobadas. Se corrigieron la invalidación de respuestas en móvil y el guard del rol administrado de Supabase. Las migraciones 001–005 ya están aplicadas en Supabase y su conexión SQL dedicada fue verificada; faltan imágenes/despliegue, DSN de Auth/Listado y aceptación con celular físico. Los resultados del 24/11 que siguen se conservan como antecedente.

## Implementado en código

- Convivencia persiste tareas mediante migración `005_tareas.up.sql`; permite crear, listar por estado con cursor ligado al actor y arriendo, reasignar pendientes a integrantes activos y completar solo por el asignado activo. La creación valida asignado activo y la baja de pertenencia desasigna tareas pendientes. Un retirado recibe 403 en operaciones de tareas.
- Gateway reenvía las rutas públicas del contrato. BFF usa la sesión de la web, valida campos, aplica protección de origen/CSRF para escrituras, conserva 403/422 y limita los datos de respuesta.
- La vista `/mi-arriendo/tareas` usa datos de API, filtros Pendiente/Completada, paginación, miembros activos, creación, reasignación, completado, carga y errores. No actualiza estado de forma optimista: si PATCH falla, mantiene la lista anterior. Al volver a la pestaña consulta tareas y miembros otra vez.
- La API de integrantes de Convivencia expone IDs activos y fechas de ingreso; aún no hay fuente de nombres para otros miembros, por lo que la web usa «Integrante #ID» cuando `nombre` es nulo.
- El cliente Expo local consulta el mismo Gateway para conocer el arriendo actual y listar tareas por estado con cursor. Permite completar solo las asignadas al usuario actual y vuelve a consultar tras el PATCH. Un fallo deja la tarea sin cambios visibles y muestra el error. El dashboard Arriendo vuelve a mostrar cuatro tarjetas compactas de tareas pendientes, inspiradas en el mockup y alimentadas por la API; el contrato no incluye fecha, por lo que muestra estado/asignación. Se ajustaron además las tarjetas de lugar y recordatorios al color y disposición del mockup. La lista ya no repite el título de la cabecera.

## Antecedente de validación local sanitizada (24/11)

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

Las pruebas del 24/11 usaban repositorio/transporte simulados y no acreditaban persistencia integrada. El 26/11 se ejecutaron la migración y los casos de tareas contra PostgreSQL efímero y se añadió el recorrido integrado BFF/Gateway/SQL/adaptador móvil. Véanse los [resultados actuales y sus límites](E04-validacion-local-2026-11-26.md). Las cuentas reales y la aceptación desplegada siguen pendientes.

## Dependencia TI4 y aceptación pendiente

El cliente móvil local implementa E04 sobre la API y conserva datos simulados del dashboard fuera de E04. La revisión del 26/11 valida TypeScript, lint, adaptador y los casos de pantalla descritos en el informe, con hosts RN/Router simulados. No identifica una versión instalada en celular ni valida Supabase. Falta configurar/verificar la URL compartida del Gateway, la entrega en dispositivo físico y el responsable TI4 en B01; no se detectó `adb` disponible en PATH.

Para aceptar E04 falta: desplegar Convivencia y Gateway con Auth funcional (las migraciones de Convivencia ya están aplicadas); identificar sus SHA/URL y la versión Expo; ejecutar en el mismo Gateway creación en la interfaz web → lectura/completado en celular físico → lectura persistida en web; registrar dispositivo, cuentas sanitizadas, comandos/resultados, 403 no asignado y retirado, 422 asignado inválido y fallo de PATCH visible sin cambio. Registrar el bloqueo en E06/B06 si sigue pendiente la entrega TI4 prevista para el 24. Estado: **implementado, migrado en Supabase y validado localmente; aceptación desplegada/física pendiente**. No se declara cumplimiento completo de FR-71 a 74/149.
