# Evidencia S3R-E05 / SCRUM-122

Fecha: 24/11/2026 America/Santiago. Entorno Windows/PowerShell, Python 3.14.7, Node v24.20.0, Next 16.4.3, Chromium 1255. HTTP de prueba exclusivamente en loopback, datos ficticios, sin cuentas reales ni dotenv en build/navegador. Se instalo PyJWT 2.10.1 para las pruebas HTTP locales; la dependencia de despliegue conserva su version declarada.

SHA base: `623a95f07a658be1125b5ddc525ed827fc3e9c7d`. Cambios sin commit en `SCRUM-122-Conectar-retiro-por-arrendador-y-revocar-la-experiencia-activa`. [Jira](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-122). PR pendiente. [Manifest SHA-256 de fuentes](sources-sha256.txt) identifica el contenido revisado, incluido codigo nuevo que no aparece en `git diff` sin stage.

## Resultados

| Comprobacion | Resultado | Limite |
|---|---|---|
| Convivencia HTTP/adaptadores | 58 passed | Repositorio o transporte simulado; valida propietario ajeno/admin sin mutar, motivo, confirmacion y puertos |
| Convivencia retiro SQL | 5 skipped | initdb local termina con 3221226505; el runner informa que no pudo inicializar PostgreSQL efimero |
| Listado cierre/proyeccion y enlace del arriendo | 4 passed | Repositorio simulado; cierre, evento antiguo y ocupacion invalida |
| Gateway | 157 passed | Upstream HTTP simulado; incluye retiro, integrantes y tareas |
| BFF retiro y regresion de reportes | 9 passed | Cookies, CSRF, validacion, errores y DTO con transportes simulados |
| Chromium + Next/BFF | 1 passed | HTTP sintetico: confirma formulario, doble clic envia 1 POST, accion oculta a no propietario, revocacion elimina tarea visible |
| typegen / TypeScript | exit 0 | Fuentes del frontend |
| ESLint archivos modificados | exit 0, sin advertencias | Fuentes del frontend |
| Build aislado | exit 0 | Compilacion de produccion sin dotenv, red externa bloqueada |
| git diff --check | exit 0 | Espacios y marcadores |

## Capturas sanitizadas

- [Confirmacion con motivo y checkbox](01-confirmacion-retiro.png).
- [Tareas desmontadas tras perdida de membresia](02-acceso-revocado.png).

Las capturas proceden de fixtures y no acreditan persistencia en servicios desplegados.

## Comandos reproducibles

Desde `frontend-next`:

```powershell
node node_modules/next/dist/bin/next typegen
node node_modules/typescript/bin/tsc --noEmit
node --test tests/expulsiones.test.mjs tests/reportes.test.mjs
# Definir REPORTS_PLAYWRIGHT_PATH al modulo Playwright instalado y
# REPORTS_BROWSER_PATH al ejecutable Chromium local para evitar que se omita:
node --test tests/expulsiones-browser.test.mjs
node node_modules/eslint/bin/eslint.js src/features/recorrido/RemoveMember.tsx src/features/recorrido/MemberDirectory.tsx src/features/recorrido/MemberAccessGate.tsx src/features/recorrido/MemberPageGate.tsx src/features/recorrido/TasksPreviewPage.tsx src/features/recorrido/ConvivenciaViews.tsx src/features/recorrido/ChatPreviewPage.tsx src/features/reportes/RentalWithReports.tsx src/lib/recorrido/server.ts src/lib/recorrido/tasks.ts src/lib/reportes.ts
node tests/build-isolated.mjs
```

Desde el servicio Convivencia:

```powershell
python tests/run_offline.py tests/test_retiro.py
# Resultado: 58 passed, 5 skipped; 1 aviso de deprecacion Starlette/httpx.
python tests/run_isolated.py
# Exit 1: No se pudo inicializar PostgreSQL efimero (sin credenciales reales).
```

Desde la raiz web:

```powershell
python -I -B backend/api-gateway/tests/run_isolated.py
# 157 passed
```

Listado se ejecuto en un interprete con entorno vaciado y `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`, incorporando las rutas del servicio y raiz web a sys.path, mediante `pytest.main(['tests/test_departure_projection.py', '--import-mode=importlib', '-q', '-p', 'no:cacheprovider'])` desde ese servicio: 4 passed y aviso de deprecacion Starlette/httpx. No utilizo base de datos.

## Pendiente para aceptacion

Ejecutar `tests/run_isolated.py` de Convivencia en un entorno donde PostgreSQL arranque y luego el recorrido sobre Gateway/servicios migrados: doble retiro, admin ajeno, tareas pendientes/completadas, responsable vacante, ultimo integrante, denegacion de lectura/envio y recuperacion de outbox. El desarrollo y la comprobacion de cliente estan listos; los resultados SQL no se infieren de mocks ni de capturas.

## Integración con SCRUM-123 · 25/11/2026

Se reconcilió `9c9ab5e` con `dev-web` en `d934a97`, que ya contiene SCRUM-122 y E04. Se conserva el contrato de retiro y tareas integrado en `dev-web`, incluido el formulario `RemoveMember`, la paginación y la comprobación periódica de pertenencia. Las implementaciones alternativas de servicio, BFF y pantalla de tareas se retiraron para evitar rutas y modelos duplicados. Sus commits siguen en el historial.

La secuencia de migración vigente es `001`–`004`, [005_retiro.up.sql](../../../backend/services/convivencia-mensajeria-service/migrations/005_retiro.up.sql) y [006_tareas_reasignables.up.sql](../../../backend/services/convivencia-mensajeria-service/migrations/006_tareas_reasignables.up.sql). Se retiró `005_retiros.up.sql`, que creaba las mismas tablas con un esquema incompatible. Esta integración no aplica migraciones sobre bases compartidas.

Se conserva el control de pertenencia móvil de SCRUM-123: consulta real al entrar/regresar a la app, desmontaje de pantallas privadas y vaciado del almacén tras una denegación. También se conserva el enlace de postulantes aceptados a la gestión de integrantes.

Validación de la integración: Convivencia, 92 pruebas aprobadas con PostgreSQL efímero y migraciones 001–006; Gateway, 185 aprobadas; Listado, 4 pruebas de proyección de retiro aprobadas; web/BFF y regresiones HTTP, 58 aprobadas; convivencia móvil, 12 aprobadas. Typecheck y lint web pasaron. Los resultados y el manifiesto de la sección anterior describen la revisión histórica de SCRUM-122, no certifican por sí solos este merge.

La prueba adicional `npm.cmd run test:convivencia-browser` pasó (1 prueba) con Next/BFF reales y Edge con API sintética, sin Playwright ni cuentas reales; reproduce confirmación, doble clic, respuesta perdida, ausencia de acción para quien no es dueño y revocación de tareas. `E05_QA_DIR` permite regenerar las capturas complementarias [escritorio](retiro-confirmacion.png) y [ancho móvil web](retiro-confirmacion-mobile.png). La aceptación en despliegue y celular físico continúa pendiente.
