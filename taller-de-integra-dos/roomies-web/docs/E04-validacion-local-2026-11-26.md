# E04 — Cierre local y aceptación pendiente

Fecha: 26/11/2026. Jira: SCRUM-121. Rama: `SCRUM-121-Conectar-tareas-compartidas-y-prueba-cruzada`.
SHA de partida: `593de79789c412f5c26c9922537f2fe003c439a9`. Los cambios de este informe están en el árbol de trabajo, sin commit ni PR; ese SHA no identifica la nueva validación ni una versión desplegada.

**Actualización Supabase:** las migraciones 001–005 ya están aplicadas en el proyecto autorizado. Se creó y verificó la conexión del rol de Convivencia, con TLS `verify-full` y CA oficial. Las tablas de negocio existentes conservaron sus huellas. Una prueba SQL transaccional verificó creación/completado y desasignación por retiro sin dejar filas; no sustituye la aceptación HTTP/Expo. Véanse [migración](evidence/E04/migracion-supabase-2026-11-26.json), [conexión](evidence/E04/conexion-convivencia-2026-11-26.json) y [prueba SQL](evidence/E04/sql-smoke-supabase-2026-11-26.json). Faltan las imágenes, los DSN existentes de Auth/Listado y el recorrido en celular.

## Completado en esta revisión

- Ejecutada la migración de tareas junto a las migraciones anteriores en PostgreSQL 19 efímero. Se usa el rol restringido del servicio, sin bases remotas ni credenciales reales.
- Añadidas cinco pruebas SQL: creación/reasignación/completado persistido en otra conexión; 65 tareas filtradas antes del límite y tres páginas sin duplicados; actor ajeno y asignado inválido; retiro con desasignación de pendientes y conservación del historial completado; completado concurrente con retiro que no elude la revocación.
- Añadido recorrido integrado con el BFF TypeScript, Gateway HTTP, API de Convivencia y PostgreSQL reales, y el adaptador TypeScript móvil con transporte HTTP inyectado. Se crea desde el BFF web, se asigna, se lee/completa con el adaptador móvil y se consulta nuevamente desde el BFF. Verifica persistencia, 403 de no asignado/retirado, 422 de asignado inválido, paginación y cursor ligado al actor/estado. El retiro se ejecuta con el rol SQL del servicio y comprueba el trigger de desasignación.
- Verificado que un fallo de transporte antes del PATCH devuelve 503 y conserva la tarea pendiente. Un fallo después de confirmar en servidor sigue requiriendo actualizar la lista antes de reintentar; no se atribuye a esta prueba cobertura de esa ambigüedad.
- Corregida la pantalla móvil: invalida respuestas al salir/cambiar de cuenta, limpia datos de la cuenta anterior, bloquea acciones durante carga/guardado y comprueba de nuevo la pertenencia tras un PATCH 403. Una sesión rechazada con 401 elimina los datos visibles.
- Añadida prueba en Edge con React real para PATCH fallido, retiro, cambio de cuenta y respuesta tardía tras perder foco. Sustituye únicamente los hosts de React Native/Router y el transporte; no ejecuta el SDK Expo ni acredita un celular físico.
- Actualizada una prueba antigua de permisos: el retiro está autorizado desde la migración de mensajería, mientras la capacidad del arriendo y la identidad de la pertenencia siguen protegidas. No se amplían permisos SQL.
- Normalizada la importación relativa del proxy del Gateway para cargarlo junto al servicio durante la integración; sus 24 pruebas de rutas pasan.

## Resultados

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| Suite Convivencia con PostgreSQL efímero | **79 pasan**, sin omitidas | Incluye cinco pruebas SQL, recorrido integrado y seis casos del guard de roles Supabase |
| Rutas del Gateway | **24 pasan** | Upstream simulado |
| BFF tareas | **2 pasan** | Contrato, sesión, origen y errores |
| Adaptador móvil tareas | **2 pasan** | Contrato y errores con transporte simulado |
| Pantalla móvil en Edge | **1 pasa**, sin omitir | Cuatro escenarios; hosts RN/Router simulados |
| Build web aislado | **Pasa**, incluido TypeScript | Fuentes actuales, sin dotenv ni credenciales heredadas |
| TypeScript móvil y Expo lint | **Pasan**, sin advertencias | Expo instalado SDK 57 |
| ESLint de los nuevos drivers JS | **Pasa** | Dos archivos de pruebas |
| `git diff --check` | **Pasa** | Sin errores de formato |

Herramientas observadas: Windows/PowerShell, Python 3.14.7, Node 24.20.0, PostgreSQL 19 y Next instalado 16.4.6. La suite Python informa una advertencia de deprecación de Starlette/httpx.

La comprobación de TypeScript directamente en la carpeta web encontró un validador antiguo en la caché de desarrollo que referencia una ruta de expulsiones ausente. El build aislado genera los tipos desde las fuentes actuales y pasa; no se modificó la caché del usuario para ocultar ese resultado.

## Reproducción

Desde la raíz de `roomies-web`, con PostgreSQL local, el entorno Python y las dependencias web/móviles ya instalados:

```powershell
$python = 'C:/taller-de-integra-/.venv/Scripts/python.exe'
& $python -I -B backend/services/convivencia-mensajeria-service/tests/run_isolated.py
# 79 passed; crea y elimina exclusivamente su propio clúster temporal.

Set-Location backend/api-gateway
$env:PYTHONPATH = (Get-Location).Path
& $python -B -m pytest tests/test_convivencia_routes.py -q -p no:cacheprovider
# 24 passed

Set-Location ../../frontend-next
npm run test:tareas
npm run build:isolated
node node_modules/eslint/bin/eslint.js tests/tareas-cross-client.mjs tests/tareas-mobile-browser.test.mjs
$env:REPORTS_PLAYWRIGHT_PATH = (Resolve-Path node_modules/playwright).Path
$env:REPORTS_BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm run test:tareas-mobile-browser
# 1 passed, 0 skipped. Sin estas dos variables se omite explícitamente.

Set-Location '../../../taller de integra cuatro/roomies-app-movil'
npm run test:tareas
node node_modules/typescript/bin/tsc --noEmit
node node_modules/expo/bin/cli lint
```

El driver integrado se ejecuta desde pytest; no se debe apuntar a un Gateway remoto ni interpretar sus tokens ficticios como cuentas reales. La identidad se inyecta exclusivamente en la instancia de API de prueba. No se prueba Supabase, el login, el cliente HTTP/Supabase completo de Expo ni las pantallas web en ese recorrido.

## Pendiente para aceptar E04

1. Publicar imágenes válidas y desplegar versiones compatibles de Convivencia/Gateway y Auth/Listado. Las migraciones 001–005 de Convivencia ya están aplicadas en Supabase; faltan los DSN existentes de Auth/Listado, publicación/build y despliegue. Next local y Expo comparten Gateway TEST, pero Vercel todavía debe actualizarse. No se guardaron cambios en Kubero ni se construyeron imágenes. No hay Docker/Podman ni `adb` disponibles en PATH.
2. Ejecutar con dos cuentas reales: crear/asignar en la **interfaz web**, leer/completar en **Expo en celular físico** y volver a la web para comprobar el resultado persistido. Repetir los casos 403/422, retiro y PATCH fallido en ese entorno.
3. Registrar responsable TI4 en B01, dispositivo, versión instalada de Expo/app, URL/SHA desplegados y evidencias sanitizadas en PR/Jira. La asignación TI4 y la aceptación cruzada siguen pendientes; corresponde reflejar el bloqueo en E06/B06 si continúa.

Estado: **implementación y validación local ampliadas; aceptación desplegada y física pendiente**. Estas pruebas no cierran por sí solas FR-71 a 74/149.

## Intento de despliegue posterior del 26/11

Se accedió a Kubero TEST y se confirmó que faltan las apps Auth/Listado/Convivencia y sus upstreams en el Gateway. Las dos cuentas reales autenticaron en Supabase con 200 y correo confirmado; perfil/arriendo en Gateway y login del BFF publicado devolvieron 503. [Resultados remotos sanitizados](evidence/E04/preflight-remoto-2026-11-26.json).

Se configuraron los archivos locales ignorados de Next y Expo hacia el mismo Gateway TEST/proyecto Supabase. La configuración BFF local valida correctamente; esto no actualiza Vercel ni acredita funcionamiento del backend remoto.

Se preparó y validó el [workflow de cuatro imágenes](../../../.github/workflows/e04-test-images.yml), pendiente de la autorización solicitada para publicar la rama. El [instructivo de despliegue](../backend/deploy/kubero/README.md) incluye variables, dependencias, preflight SQL y criterios de aceptación. Después de habilitar el Dashboard se aplicaron 001–005 y se verificó el rol de Convivencia. El primer intento se revirtió por una validación incompatible con la membresía administrativa de Supabase; se corrigió sin permitir herencia del runtime, se agregaron seis pruebas y la suite completa pasa con 79 casos. La credencial nueva quedó cifrada fuera de Git; no se rotaron las de Auth/Listado. No se sustituyeron imágenes en Kubero ni se acreditó dispositivo físico.

## Archivos de evidencia

- [Pruebas SQL](../backend/services/convivencia-mensajeria-service/tests/test_tareas_sql.py)
- [Integración Python](../backend/services/convivencia-mensajeria-service/tests/test_tareas_cross_client.py)
- [Driver BFF/adaptador móvil](../frontend-next/tests/tareas-cross-client.mjs)
- [Prueba de pantalla móvil en navegador](../frontend-next/tests/tareas-mobile-browser.test.mjs)
- [Pantalla móvil](../../../taller%20de%20integra%20cuatro/roomies-app-movil/src/app/convivencia/tareas.tsx)
