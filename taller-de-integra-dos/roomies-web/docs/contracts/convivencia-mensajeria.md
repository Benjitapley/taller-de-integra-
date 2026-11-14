# Contrato de Convivencia/Mensajería

Este servicio es dueño exclusivo de `convivencia_mensajeria`. No consulta tablas
de Listado ni expone sus operaciones internas a través del Gateway. Las rutas
de usuario requieren JWT válido y correo confirmado; las rutas `/internal/*`
requieren `X-Roomies-Service` con el secreto compartido entre servicios.

## Incorporación y coordinación de capacidad

El flujo de aceptación de Listado (S3R-C03) reserva una plaza por HTTP antes de
confirmar la postulación:

1. `POST /internal/incorporaciones` recibe
   `{"event_key":"postulacion:123:Aceptada","id_postulacion":123,"id_publicacion":45,"id_usuario":67}`.
2. Convivencia solicita a Listado una reserva idempotente para esa misma clave.
   Listado verifica publicación y postulación, bloquea únicamente sus propios
   datos, y devuelve `id_reserva`, `id_publicacion`, `id_usuario`,
   `id_arrendador`, `cupos_totales`, `version_capacidad` y `expires_at`.
3. Convivencia bloquea su arriendo, aplica las restricciones únicas de
   publicación/usuario, crea la primera pertenencia como `Responsable`, persiste
   la conversación y encola la actualización de ocupación en la misma
   transacción.
4. El publicador del outbox confirma la reserva mediante
   `PUT /internal/publicaciones/{id}/ocupacion`. Si el proceso cae, reintenta
   el mismo evento. Los reintentos de admisión con la misma clave devuelven la
   misma pertenencia; una clave con otro payload da `409`.

Listado implementa estas rutas, todas protegidas con `X-Roomies-Service`:

| Método y ruta | Propósito |
|---|---|
| `GET /internal/publicaciones/{id}` | Consultar dueño y datos de capacidad, sin exponerlos a clientes. |
| `POST /internal/publicaciones/{id}/reservas` | Crear/reutilizar la reserva idempotente; TTL inicial de cinco minutos. |
| `DELETE /internal/publicaciones/{id}/reservas` | Liberar una reserva fallida aún no confirmada. |
| `PUT /internal/publicaciones/{id}/ocupacion` | Aplicar ocupación versionada y confirmar una reserva si corresponde. |

El evento de ocupación incluye `event_key`, `id_publicacion`,
`version_ocupacion`, `cupos_totales`, `cupos_ocupados` y `estado`. En una
incorporación incluye además `id_reserva`, `clave_incorporacion` e `id_usuario`.
Listado ignora versiones antiguas, acepta repeticiones idénticas y rechaza una
misma versión con contenido distinto. Una publicación `Activa` sin snapshot de
ocupación reconciliado no recibe nuevas reservas.

## API de convivencia

| Método y ruta | Acceso y resultado |
|---|---|
| `GET /api/arriendos/mio` | Una pertenencia activa del usuario; `404` si no existe. |
| `GET /api/arriendos/{id}` | Detalle solo para integrantes activos. |
| `GET /api/arriendos/{id}/integrantes?antes={cursor}&limite=20` | Integrantes activos y cupos; solo miembros activos. |
| `POST /api/arriendos/{id}/expulsiones` | Solo el dueño actual de la publicación. |
| `GET /api/conversaciones?antes={cursor}&limite=20` | Conversaciones de pertenencias activas. |
| `GET /api/conversaciones/{id}` | Detalle solo para integrantes activos. |
| `GET /api/conversaciones/{id}/mensajes?antes={cursor}&limite=20` | Historia hacia atrás; límite 1–100, default 20. |
| `POST /api/conversaciones/{id}/mensajes` | Mensaje de texto de 1–2000 caracteres. |

El envío recibe `{"id_cliente":"UUID","contenido":"..."}`. La unicidad por
conversación, emisor e `id_cliente` hace idempotentes los reintentos; reutilizar
el UUID con otro contenido da `409`. La paginación devuelve
`{"items":[...],"siguiente_cursor":null}`. El cursor es firmado, vinculado a
recurso y usuario, y ordena por fecha/ID. La consulta de mensajes limita además
el historial a la fecha de ingreso. No hay Realtime ni conversaciones de
postulación/exploración.

El retiro recibe
`{"id_usuario":67,"motivo":"...","confirmar":true,"idempotency_key":"..."}`.
La identidad de dueño se vuelve a consultar por API a Listado; el rol de
administrador no concede autorización. Una transacción local marca la
pertenencia retirada, conserva motivo/actor/fecha, desasigna tareas pendientes,
revoca todo acceso por las comprobaciones de pertenencia activa, incrementa la
versión de ocupación y agrega el outbox. El último retiro finaliza el arriendo
y solicita cerrar la publicación. Un responsable retirado deja el rol vacante;
no se implementa relevo. El reporte administrativo no llama a esta operación.

Las rutas internas adicionales son `GET /internal/pertenencias/{id}` y
`GET /internal/relaciones?user_a={id}&user_b={id}`. La segunda informa relación
histórica compartida para Reportes; ninguna se publica en el Gateway.

## Persistencia y ejecución

- Convivencia: `backend/services/convivencia-mensajeria-service/migrations/001_convivencia_mensajeria.up.sql`.
- Capacidad de Listado: `backend/services/listado-applications-service/migrations/001_capacity_coordination.up.sql`.
- Las migraciones crean permisos limitados para los roles de runtime; no
  comparten tablas ni credenciales de escritura entre dominios.
- El stack local ejecuta ambas migraciones al crear un volumen nuevo. Para un
  entorno Supabase, el operador debe provisionar los roles dedicados, aplicar
  ambas migraciones aprobadas y configurar `CONVIVENCIA_DATABASE_URL`,
  `ROOMIES_CURSOR_SECRET` (mínimo 32 caracteres), `ROOMIES_INTERNAL_TOKEN` y
  `LISTADO_UPSTREAM_URL`. No se incluyen credenciales en el repositorio.
- El servicio tiene reintentos durables para los eventos de ocupación. Una
  respuesta exitosa de salud indica proceso activo, no certifica que las
  dependencias o las migraciones estén listas.
