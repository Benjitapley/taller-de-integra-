# SCRUM-97 · Notificaciones mínimas

La [matriz de Sprint 3](contracts/SCRUM-99-contrato-alcance-S3-v1.4.md) define tres avisos para la bandeja del usuario. Los demás eventos de dominio, como cambios de ocupación o cierre de publicación, se usan para coordinar los servicios.

## Recepción y deduplicación

`POST /internal/notificaciones` admite `tipo`, `id_usuario`, `referencia_id`, `event_key` y `estado` según el tipo. La cabecera `Idempotency-Key` debe coincidir con `event_key`. El JWT interno exige una clave de su productor, audiencia `auth-users` y una vigencia máxima de 60 segundos.

| Aviso | Emisor | Clave estable | Referencia y estado |
| --- | --- | --- | --- |
| `postulacion_resultado` | Listado | `postulacion:<id_postulacion>:<estado>` | ID de postulación. Estado `Preseleccionada`, `Aceptada`, `Rechazada` o `Cancelada`. |
| `reporte_actualizado` | Reportes | `reporte_actualizado:<id_actuacion>` | ID de reporte. Estado `En_Revision`, `Resuelto` o `Descartado`. |
| `expulsion` | Convivencia | `expulsion:<uuid_de_operacion>` | ID de arriendo. Estado `Expulsado` si se incluye. El destinatario es el usuario expulsado. |

Auth/Users reutiliza la restricción única sobre `event_key`. El reenvío con el mismo contenido confirma el aviso existente. Una clave con otro contenido válido devuelve `409`. Listado puede usar el contrato común con JWT y mantiene su ruta anterior para instalaciones que aún usan la credencial compartida. Ambas formas utilizan la misma clave y el mismo tipo almacenado para preservar los avisos anteriores. Reportes usa el mismo transporte y conserva sus claves de SCRUM-96.

La recepción de expulsión está implementada y se ensaya con un emisor ficticio. La rama aún carece de la operación de expulsión de Convivencia. Al incorporarla, su transacción deberá encolar el aviso y su proceso de entrega podrá utilizar el transporte común conservando la clave de la operación.

## Consulta y configuración

- `GET /api/notificaciones` devuelve solo los avisos de la sesión autenticada, del más reciente al más antiguo. Cada elemento incluye `id_notificacion`, `tipo`, `referencia_id` y `fecha`. `limite` vale 20 por defecto y admite de 1 a 100. La respuesta trae `items` y `siguiente_cursor`. El cursor firmado queda vinculado a la cuenta.
- `GET /local/v1/notificaciones` y `GET /api/v1/notificaciones` conservan el formato anterior. El Gateway publica únicamente las consultas de usuario.
- En Auth/Users, configurar `AUTH_NOTIFICATIONS_CURSOR_SECRET` para la consulta paginada. Para habilitar la entrega canónica de Listado, configurar `LISTADO_AUTH_JWT_KEY` en Listado y Auth/Users. Auth acepta expulsiones con `CONVIVENCIA_AUTH_JWT_KEY`. Reportes mantiene `REPORTES_AUTH_JWT_KEY` de SCRUM-96. Usar claves distintas de al menos 32 caracteres.
- El flujo reutiliza la tabla de avisos y las colas ya instaladas. El ensayo se ejecuta con `python -I -B backend/local_stack/run_stack.py --pg-bin "<directorio bin de PostgreSQL>" --reports`. La opción `--progressive` prueba la variante heredada.
