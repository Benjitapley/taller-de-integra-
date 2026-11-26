# SCRUM-120 / S3R-E03 — PostgreSQL validado; aceptación web pendiente

- Fecha: 2026-11-25, 23:16 America/Santiago.
- HEAD base: `4dafd2308893c5a766492875ba1e1198ed4f73a8`.
- Los cambios están sin commit. Este SHA identifica la base y no incluye las correcciones de esta revisión.
- Entorno: Windows / PowerShell, PostgreSQL 19.0 real en `127.0.0.1:5432`.
- **No cerrar Jira:** falta la aceptación con dos identidades de staging, Gateway y navegador.

## Base y migraciones

El operador completó la recuperación administrativa. Se verificó acceso autenticado sin mostrar contraseñas. Las credenciales se mantienen fuera del repositorio, en un directorio privado del usuario.

```powershell
python -B backend/local_stack/provision_local.py
```

La instancia solo contenía `postgres`. El runner creó `roomies_local` y cuatro roles dedicados de Auth, Listado, Match y Convivencia, sin superusuario, creación de bases/roles, replicación ni bypass RLS.

Se confirmaron 15 entradas en `roomies_local_meta.migration`: Auth 001–002; bootstrap local adaptado; suplemento local de campos de usuario; Listado 001–004 (incluidas imágenes y admisiones); Convivencia 001–007. El bootstrap original no se modificó: se reutiliza su SQL adaptando el nombre de base y evitando recrear la tabla Auth que ya suministra su migración.

Los archivos se registran con su hash en la misma transacción que el DDL. La segunda ejecución omitió las entradas existentes con `SKIP`. El runner rechaza esquemas preexistentes sin registro y archivos aplicados cuyo hash cambió.

Las nuevas migraciones añaden índice cronológico, concilian `mensajes`/`id_emisor` conservando datos e índices, y crean registro/outbox de expulsiones. La vista `mensaje` conserva compatibilidad de herramientas anteriores; el DTO HTTP conserva `id_remitente`.

## SQL real y resultados sanitizados

Sobre la base de integración:

```sql
SELECT current_database();
-- roomies_local
SELECT count(*) FROM roomies_local_meta.migration;
-- 15
SELECT to_regclass('convivencia_mensajeria.mensajes');
-- convivencia_mensajeria.mensajes
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid='convivencia_mensajeria.mensajes'::regclass AND contype='u';
-- UNIQUE (id_conversacion, id_emisor, id_cliente)
SELECT count(*) FROM convivencia_mensajeria.mensajes;
-- 0
SELECT count(*) FROM (
 SELECT id_conversacion,id_emisor,id_cliente
 FROM convivencia_mensajeria.mensajes
 GROUP BY 1,2,3 HAVING count(*) > 1
) duplicados;
-- 0
```

La base de integración permanece vacía de mensajes; ese conteo no acredita por sí solo el reintento. La prueba de reintento utilizó una base temporal propia del mismo servidor en 5432:

```powershell
python -B backend/local_stack/test_e03_postgres.py
```

```text
Servidor real 127.0.0.1:5432; base de regresión propia; sin mocks de SQL ni HTTP.
SQL historial: 35 mensajes autorizados, dos páginas sin duplicados; cursor final NULL; preingreso excluido.
SQL idempotencia: COUNT(*) por conversación/emisor/id_cliente = 1
3 passed in 2.12s
PASS eliminación de la base de regresión propia; roomies_local conservada.
```

Las pruebas comprobaron mismo `id_mensaje` al reintentar, conflicto de dominio 409 ante contenido distinto y una sola fila por UUID. También verificaron 403 del repositorio para integrantes inactivos/terceros con `codigo: sin_permiso`. Son pruebas SQL reales, sin llamadas HTTP simuladas; no acreditan login, Gateway, expulsión HTTP ni flujo visual.

## Correcciones

- Historial ordenado por `(fecha_envio,id_mensaje)`, ancla limitada a conversación/ingreso y cursor ligado al usuario/conversación. El ingreso efectivo corresponde a `pertenencia.creada_en`.
- Bloqueo compartido de pertenencia durante lectura/envío; revocación serializada con el cambio de estado.
- `siguiente_cursor: null` explícito; UUID de otros emisores omitido. Idempotencia sin exigir `Idempotency-Key` para mensajes.
- Errores de dominio con `codigo: sin_permiso`, conservando `code`. El BFF devuelve el código canónico en los rechazos 403.
- AbortController y generación para descartar respuestas tardías. Limpieza de mensajes, borrador, cursor y nombre en cambios de sesión y 401/403/404. Avisos entre pestañas mediante BroadcastChannel, sin mensajes ni credenciales en los avisos.
- POST de expulsiones en Convivencia/Gateway: actor desde sesión, dueño consultado a Listado, motivo 1..500, confirmación estricta, retiro idempotente, registro y outbox durable para ocupación/cierre al quedar en cero.
- Endpoints internos de Listado para consultar dueño y actualizar ocupación/cierre con versión monotónica.
- Modo `local-postgres`: datos en loopback:5432 con roles dedicados e identidad Supabase alojada restringida al proyecto explícito. BFF equivalente en desarrollo, sin autoconfirmación.
- Runner aislado de Auth corregido para admitir su dependencia `backend.service_runtime`, conservando bloqueo de otros backends/red/SQL.

No hay tablas de tareas en el servicio; no se acredita desasignación de tareas por expulsión. No se encontraron WebSocket ni Supabase Realtime en la implementación del chat.

## Regresión automatizada

Comandos desde la raíz, salvo frontend:

| Comando | Resultado |
| --- | --- |
| `python -B backend/local_stack/test_e03_postgres.py` | 3 aprobadas; SQL real en 5432. |
| `python -I -B backend/services/convivencia-mensajeria-service/tests/run_isolated.py` | 76 aprobadas antes de añadir las cinco pruebas de dominio de expulsión. |
| Mismo runner con `-k expulsion` tras añadirlas | 12 aprobadas, 69 deseleccionadas; autorización, idempotencia, revocación y recuperación de outbox. |
| `python -I -B backend/api-gateway/tests/run_isolated.py` | 152 aprobadas. |
| `python -I -B backend/services/auth-users-service/tests/run_isolated.py` | 155 aprobadas, 2 omitidas. |
| `python -I -B backend/services/listado-applications-service/tests/run_isolated.py` | 63 aprobadas. |
| `python -I -B backend/local_stack/run_unit.py runtime` | 57 aprobadas. |
| `node --test tests/auth-client.test.mjs tests/supabase-auth.test.mjs` en frontend | 26 aprobadas, incluida configuración híbrida. |
| `next typegen`, `tsc --noEmit`, ESLint de los módulos chat/autenticación modificados | Aprobados; ESLint sin advertencias. |
| `git diff --check` | Aprobado. |

Se instalaron las dependencias fijadas en `auth-users-service/requirements.txt` que faltaban o tenían otra versión. Se repitió Listado: su fallo inicial de WebP desapareció con Pillow 13.0.0. Permanece una advertencia de deprecación de Starlette TestClient/httpx.

Las suites aisladas existentes usan puertos/repositorios simulados según su categoría y PostgreSQL efímero cuando corresponde. Son regresiones y no aceptación integrada sin mocks.

Se intentó la suite completa del frontend con `node --test tests/*.test.mjs`: **143 aprobadas, 2 fallidas, 3 omitidas**, antes de añadir la prueba híbrida. Fallos en `tests/reportes.test.mjs`: desactivación por flag espera 404 y recibe 503; fixture de integrantes incompleto frente al DTO actual. No se modificaron los módulos de Reportes. No se declara toda la suite verde ni se afirma haber reproducido esos fallos sobre el SHA base sin cambios. Las tres pruebas de navegador omitidas requieren activación explícita.

## Criterios de aceptación

| Criterio | Evidencia y pendiente |
| --- | --- |
| Pila completa sobre PostgreSQL real | Base/roles verificados; falta arrancar la pila con configuración pública de identidad del staging confirmado. |
| Dos cuentas, F5, orden e ingreso | Orden/ingreso comprobados en SQL; dos identidades, Gateway y F5 pendientes. |
| Reintento sin duplicados y 409 | Comprobado en repositorio/PostgreSQL real; HTTP/UI pendientes. |
| Expulsión, terceros y dueño no residente | Implementación y pruebas aisladas; sesión real, Gateway, UI y dueño no residente pendientes. |
| Respuestas tardías y fallos de red | Cancelación/limpieza implementadas; escenario de navegador real pendiente. |
| Paginación y posición visual | Dos páginas y cursor final comprobados en SQL; scrollTop y continuidad visual pendientes. |

## Datos públicos pendientes para continuar

Supabase Auth está alojado. No se necesitan archivos internos de GoTrue, compartir un `.env` ni recibir claves administrativas. Falta confirmar la URL/proyecto de **staging** y su clave pública `sb_publishable_…`. La única referencia encontrada en el repositorio está en un ejemplo y no acredita cuál es el staging autorizado. El frontend publicado es accesible, pero su condición de staging no está confirmada.

El operador ofreció una identidad. No se registran su correo ni contraseña aquí. No se inició sesión ni se crearon usuarios en Supabase. Para acreditar dos cuentas y roles distintos harán falta identidades de prueba disponibles en staging, que pueden iniciarse desde el navegador sin compartir contraseñas en el chat. Si se incluye la incorporación completa, Auth de staging debe tener su consulta administrativa configurada del lado servidor; no se solicita compartir esa clave.

Faltan evidencia HTTP/UI integrada, SHA final probado y enlaces PR/Jira. Este documento registra avance sanitizado y no constituye acta de cierre.
