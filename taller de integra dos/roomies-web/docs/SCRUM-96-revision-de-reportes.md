# SCRUM-96 · Revisión administrativa de reportes

En **Panel administrativo → Revisar reportes** se puede filtrar la bandeja por estado y tipo. El detalle muestra el objetivo, el denunciante, el texto y la bitácora. Una revisión pide un nuevo estado y admite una nota interna de hasta 1.000 caracteres. El permiso se verifica en Reportes con la dependencia administrativa de Auth/Users, que exige correo confirmado y presencia en `ROOMIES_ADMIN_SUBJECTS`.

## API administrativa

| Operación | Resultado |
| --- | --- |
| `GET /api/admin/reportes` | Bandeja con `items` y `siguiente_cursor`. Admite `estado`, `tipo`, `cursor` y `limite` de 1 a 100 (20 por defecto). El cursor está firmado y vinculado al administrador y a los filtros. |
| `GET /api/admin/reportes/{id}` | Detalle con `id_denunciante` e `historial`. |
| `PATCH /api/admin/reportes/{id}` | Acepta `estado` y `nota_interna` opcional. Devuelve el detalle actualizado. |

Desde `Pendiente` se puede pasar a `En_Revision` o `Descartado`. Desde `En_Revision` se puede pasar a `Resuelto` o `Descartado`. Una transición inválida responde `409`. La actuación registra el administrador, los estados anterior y nuevo, la fecha y la nota, si se incluyó. El historial de usuario y sus notificaciones solo muestran datos del reporte y su estado. Resolver un reporte registra la decisión administrativa. La operación se limita al propio reporte.

## Bitácora y notificaciones

Reportes toma un bloqueo de fila durante la revisión. Guarda la transición, añade la actuación y encola el evento `reporte_actualizado` en la misma transacción. Un proceso reintenta las entregas a `POST /internal/notificaciones` de Auth/Users y confirma la entrega en la cola cuando recibe el acuse. La clave estable `reporte_actualizado:<id_actuacion>` permite a Auth deduplicar la entrega, incluso si el acuse se pierde. La notificación lleva el destinatario, ID del reporte y nuevo estado.

## Activación

1. Aplicar la [migración de revisión](../backend/services/reportes-service/migrations/002_revision.up.sql) después de la migración 001 de SCRUM-95. Los reportes existentes quedan disponibles en la bandeja con su estado actual y una bitácora inicialmente vacía.
2. Configurar `REPORTES_AUTH_JWT_KEY` en Reportes y Auth/Users con el mismo valor. Esta clave debe ser distinta de las usadas para los otros servicios. El overlay `docker-compose.reportes.yml` asigna la clave a ambos procesos.
3. Mantener habilitada la web de reportes con `WEB_REPORTES_ENABLED=true` y configurar el rol administrativo en Auth/Users.

El ensayo local usa `python -I -B backend/local_stack/run_stack.py --pg-bin "<directorio bin de PostgreSQL>" --reports`. Añadir `--progressive` para probar el esquema heredado.

El ensayo envía dos decisiones incompatibles a un reporte en revisión y verifica una respuesta `200`, una `409` y una sola actuación adicional. También compara los cupos de la publicación y las pertenencias del arriendo antes y después de moderar. La aceptación en el entorno final requiere repetir las comprobaciones sobre la versión desplegada.
