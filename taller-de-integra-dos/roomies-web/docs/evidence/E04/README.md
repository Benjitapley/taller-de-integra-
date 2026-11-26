# S3R-E04 — tareas compartidas

Revisión y pruebas locales: **25/11/2026**, Windows, zona America/Santiago.
Responsable de E04 según backlog: Gabriel Yamaguchi. Dependencias: C05 y E02.
Trazabilidad: FR-71–74/149, D04; originales S3-E08, S3-F07, S3-F12.

**Estado: implementación web/API verificada localmente; E04 integrado sigue abierto.**
No existe evidencia recibida del recorrido en celular físico del 24/11. No se
retrofecha esta revisión ni se atribuye el cierre a un contrato o fixture.

## Revisión y cambios

Existían las cuatro rutas, persistencia, comprobación de pertenencia activa y
desasignación por retiro. Faltaban el filtro por estado, restringir visualmente
Completar al asignado activo, confirmar guardados y conservar el formulario ante
fallos. Se corrigieron esos puntos y la carga de todas las páginas de integrantes.

| Objetivo | Resultado local |
|---|---|
| Crear con título, descripción opcional y asignado opcional | API/BFF y formulario; limpia y cierra solo tras respuesta de éxito. |
| Listar/paginar por estado | Filtro antes del LIMIT en PostgreSQL; al cambiar estado se reinician filas y cursor en web. También se admite `id_asignado` en API/BFF. |
| Reasignar pendientes tras retiro | Selector controlado con integrantes activos; si falta nombre se muestra `Integrante #ID`. Pendientes desasignadas siguen disponibles. Completadas rechazan reasignación con 409. |
| Completar | Botón solo para asignado activo. ID de negocio obtenido del perfil autenticado, no del nombre ni de claims decodificados. Servicio vuelve a autorizar cada PATCH. |
| Guardado, carga y errores | Confirmación accesible, bloqueo de solicitudes repetidas, reintento de página y preservación del estado anterior ante fallo. Un 403 de asignación obsoleta no se confunde con retiro; se verifica pertenencia. |
| Retiro | API niega acceso y el guard de pertenencia limpia la vista. Completadas conservan datos; pendientes quedan sin asignado. |
| Visual | Modal blanco de 480 px, violeta, campos redondeados y acciones Cancelar/Crear, siguiendo `w_tarea.png`; responsive. Sin fecha, calendario, borrado ni reapertura según D04/contrato v2. |
| Recorrido web → Expo → web | **Pendiente**: pantalla móvil de tareas usa `useConvivenciaDemo`, sin lectura/completado persistido mediante Gateway. |

Implementación: [página](../../../frontend-next/src/features/recorrido/TasksPreviewPage.tsx),
[vista y formulario](../../../frontend-next/src/features/recorrido/ConvivenciaViews.tsx),
[BFF](../../../frontend-next/src/lib/recorrido/tasks.ts),
[API](../../../backend/services/convivencia-mensajeria-service/app/main.py) y
[repositorio](../../../backend/services/convivencia-mensajeria-service/app/repository.py).
Se mantiene la ubicación existente para reutilizar la interfaz E00.

## Contrato del recorrido

| Método/ruta pública del Gateway | Solicitud |
|---|---|
| `GET /api/arriendos/{id}/tareas` | `cursor?`, `estado?=Pendiente|Completada`, `id_asignado?`, `limite?=1..100` (20 por defecto). |
| `POST /api/arriendos/{id}/tareas` | `{titulo, descripcion?, id_asignado?}`. Nace Pendiente; 201. |
| `PATCH /api/tareas/{id}` | Solo `{id_asignado: entero positivo|null}`. |
| `PATCH /api/tareas/{id}/estado` | Solo `{estado:"Completada"}`. |

Lista: `{items: Tarea[], siguiente_cursor: string|null}`.
Tarea: `id_tarea`, `id_arriendo`, `id_creador`, `titulo` (1–120),
`descripcion` (null o hasta 1000), `id_asignado`, `estado`, `fecha_creacion`.
El BFF usa las mismas rutas bajo `/web-api`, pagina a 20 y no expone JWT al navegador.
El móvil debe llamar al mismo Gateway con JWT Supabase y el mismo entorno de cuentas.

403 por actor no activo, completar sin ser asignado o asignar a no activo; 422 por
payload/estado/cursor inválidos; 409 al reasignar completada. El cursor existente
está ligado a actor/arriendo y posición; ambos clientes deben descartarlo al cambiar
filtros/cuenta. Los filtros se conservan en cada página.

## Comandos y resultados sanitizados

Desde `frontend-next`:

```powershell
node --test tests/tareas.test.mjs tests/auth-gateway.test.mjs
# 19 aprobadas; sin fallos ni omisiones.
node node_modules/typescript/bin/tsc --noEmit
# Exit 0.
node node_modules/eslint/bin/eslint.js src/features/recorrido/TasksPreviewPage.tsx src/features/recorrido/ConvivenciaViews.tsx src/lib/recorrido/tasks.ts src/lib/auth/gateway.ts tests/tareas.test.mjs tests/tareas-browser.test.mjs
# Exit 0.
$env:REPORTS_PLAYWRIGHT_PATH='<paquete Playwright local>'
$env:REPORTS_BROWSER_PATH='<Chromium local>'
node --test tests/tareas-browser.test.mjs
# 1 aprobada, 0 fallidas, 0 omitidas; Chromium headless, Next/BFF/React reales,
# HTTP del Gateway simulado solo en loopback; sin servicios ni cuentas reales.
node tests/build-isolated.mjs
# Build de producción Next 16.4.3 aprobado; sin dotenv ni credenciales heredadas.
```

Desde la raíz de la web:

```powershell
python backend/services/convivencia-mensajeria-service/tests/run_isolated.py -k 'tasks or retiro'
# 17 aprobadas, 73 no seleccionadas. PostgreSQL 19 efímero local, rol dedicado.
# Identidad y Listado inyectados; rutas HTTP y SQL reales. Sin DB/dotenv del usuario.
# Advertencia preexistente de deprecación Starlette/httpx; no afecta resultados.
git diff --check
# Sin errores.
```

[Pruebas HTTP/SQL](../../../backend/services/convivencia-mensajeria-service/tests/test_tasks.py)
verifican 403 del no asignado, rechazo de asignado inválido, revocación tras retiro,
reasignación y completado persistidos, tres páginas filtradas y cursor de otra cuenta.
[Pruebas BFF](../../../frontend-next/tests/tareas.test.mjs) comprueban DTO, CSRF,
identidad de cookie, filtros, campos prohibidos y errores de transporte.
[Prueba de navegador](../../../frontend-next/tests/tareas-browser.test.mjs) comprueba
PATCH 503/403 sin cambio visual, POST 422 conservando campos, doble clic, selector
con integrante de segunda página, tres páginas sin duplicados, reintento, filtros,
actualización/recarga, responsive y revocación de acceso.

Capturas de **fixtures locales**, sin cuentas reales:

- [PATCH fallido y estado conservado](./01-patch-fallido.png).
- [Formulario con error y datos conservados](./02-formulario-error.png).
- [Tareas guardadas](./03-tareas-guardadas.png).
- [Formulario responsive](./04-formulario-responsive.png).

La actualización desde otro cliente se simula en el fixture. **No prueba Expo,
teléfono físico, Gateway desplegado ni persistencia compartida entre clientes reales.**

## Dependencia TI4 y escalamiento E06/B06

| Dato exigido | Registro al revisar el 25/11 |
|---|---|
| Hito de primera prueba física | 24/11 según backlog; resultado **no acreditado**. |
| Coordinación TI2 | Gabriel Yamaguchi según backlog. |
| Encargado TI4 / quién entrega / quién prueba Expo | **Sin confirmar**; registrado en [acta B01](../../architecture/SCRUM-99-acta-capacidad-S3.md#5-cliente-ti4--expo). |
| Código móvil inspeccionado | [pantalla de tareas](../../../../../taller%20de%20integra%20cuatro/roomies-app-movil/src/app/convivencia/tareas.tsx) usa datos demo. Paquete declara 1.0.0 y Expo ~57.0.24; no acredita build entregado. |
| Gateway, web y servicios desplegados / SHA / versión móvil probada | **Sin identificar/confirmar para el recorrido físico**. |
| Dispositivo físico / SO / cuentas de prueba | **Pendiente**, usar alias/IDs sanitizados y nunca JWT/contraseñas. |
| Resultado web crea → móvil lee/completa → web consulta | **No ejecutado en esta revisión**. |
| Escalamiento del 24 | No hay constancia recibida; no afirmar que ocurrió. |
| Bloqueo E06/B06 | **Abierto, detectado/documentado el 25/11**. Gabriel debe coordinar con el encargado TI4 la entrega compatible y reprogramación. No se envió comunicación externa desde esta sesión. |

Cuando TI4 confirme responsable/build: registrar acuerdo en B01, identificar URL y
SHA del Gateway/web/servicios, migraciones aplicadas y contrato, build Expo,
dispositivo/SO y dos cuentas activas en un arriendo. Crear/asignar desde web a la
cuenta móvil, consultar en teléfono, completar, volver a web y pulsar Actualizar;
recargar para comprobar persistencia. Guardar ID de tarea, fechas, capturas y
respuestas sanitizadas. Repetir los negativos (no asignado, retirado, asignado
inválido y fallo de PATCH). Adjuntar evidencia y enlace real a PR/Jira antes de cerrar.

## Identificación y fuentes

- SHA base inspeccionado: `4f4cb0522903a3f520b6e5e494973e3a45bcc202`.
- Cambios de esta revisión: árbol de trabajo local, aún sin commit/despliegue.
- Rama al revisar: `SCRUM-122-Conectar-retiro-por-arrendador-y-revocar-la-experiencia-activa`.
- PR/Jira de E04: **pendiente de enlace verificado**; no se creó ni publicó PR.
- Entorno: local aislado Windows, Node 24.20.0, Python 3.14, PostgreSQL 19,
  Next 16.4.3, Chromium 1255. Sin validación de Kubero en este recorrido.
- Precedencia: backlog v1.4 D04 y contrato Sprint3 v2 §1.6/6.3 sobre contrato
  original §6.4. No se declara cumplimiento integral de los FR recortados.

SHA256 de fuentes aportadas (no se copian los PDFs al repositorio):

| Fuente | SHA256 |
|---|---|
| Backlog TI2 Sprint3 v1.4 | `e935c0e9b0d8605295778fe41b1482be86c375d67a7cbb8890052ac796a71eb2` |
| Contrato original | `53d6d5e446f0c0a6ee20b7548dc22269d2ea7ed1df9ba828f75f6cf74d142132` |
| Contrato Sprint3 v2 editado | `78a292d7eed3c1311c61a04f60a85b9ca9c6233beeda2f54ae2e5729cd1a15e9` |
| Mockup `w_tarea.png` | `32b322a66a77737dd64bbd670e06d7644d747a279ac1493916433ef92952e987` |
