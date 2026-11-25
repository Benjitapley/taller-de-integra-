# SCRUM-95 · Envío de reportes

La web permite iniciar un reporte desde los resultados de personas o el detalle de una publicación. En **Perfil → Mis reportes** se consulta el historial privado. El formulario solicita categoría y descripción. Los nombres de campos y el límite de categoría se documentan aquí porque la [matriz de Sprint 3](contracts/SCRUM-99-contrato-alcance-S3-v1.4.md#25-reputaciónhistorialreportes--pp-2223) no enumera categorías ni identifica todos los campos.

## API pública

- `POST /api/reportes` requiere Bearer de Supabase, perfil de Roomies y correo confirmado. Acepta `categoria` (texto de 1 a 80 caracteres), `descripcion` (de 1 a 1000) y exactamente uno de `id_usuario_reportado` o `id_publicacion_reportada`. Responde `201` con `id_reporte, tipo, id_usuario_reportado, id_publicacion_reportada, categoria, descripcion, estado, fecha`. El estado inicial es `Pendiente`.
- El cliente envía un UUID en `Idempotency-Key` y lo reutiliza si reintenta el mismo envío. La clave se vincula a la cuenta. Un reintento con el mismo contenido validado devuelve `201` con el mismo ID y el estado actual. Reutilizar la clave con otros datos devuelve `409 CLAVE_IDEMPOTENCIA_REUTILIZADA`. Los clientes anteriores pueden omitir la cabecera durante la transición.
- `GET /api/reportes/mios` requiere Bearer y perfil. Devuelve `items` y `siguiente_cursor` (nulo al final). Ordena por fecha e ID descendentes. El cursor va firmado y vinculado a la cuenta. `limite` admite de 1 a 100 y vale 20 por defecto.
- El solicitante se toma de Auth/Users. Reportar el perfil propio o una publicación propia devuelve `403`. Una publicación inexistente devuelve `404`. Un reporte sobre una persona exige evidencia de conexión aceptada previa o convivencia solapada. Una consulta interna fallida devuelve `503` antes de insertar.

## Consultas privadas

| Servicio | Consulta | Resultado |
| --- | --- | --- |
| Listado | `GET /internal/publicaciones/{id}` | `id_publicacion, id_propietario, tipo, estado, cupos_totales`, o `404` con `codigo=PUBLICACION_NO_ENCONTRADA` |
| Match | `GET /internal/conexiones/relacion?a=…&b=…` | `existio`, evidencia simétrica de aceptación |
| Convivencia | `GET /internal/convivencia/relacion?a=…&b=…` | `coincidio`, intervalos solapados dentro del mismo arriendo |

Las consultas usan JWT con emisor `reportes`, audiencia exacta del servicio y vigencia de 60 segundos. El Gateway enruta únicamente las dos operaciones públicas. Match registra las aceptaciones existentes al migrar y conserva evidencia de futuras aceptaciones aunque se elimine la conexión. Convivencia marca el fin al pasar una pertenencia activa a inactiva. Las conexiones eliminadas antes de migrar y las pertenencias históricas sin fecha de término requieren evidencia verificable antes de reconocerlas.

## Activación local

1. Tras el bootstrap del clúster local, aprovisionar `sql_reportes` y `sql_convivencia_mensajeria` como roles dedicados con LOGIN, NOINHERIT y permiso CONNECT sobre la base local. Aplicar [Reportes](../backend/services/reportes-service/migrations/001_reportes.up.sql), [Match](../backend/services/match-conexion-service/migrations/001_relacion_aceptada.up.sql) y [Convivencia 002](../backend/services/convivencia-mensajeria-service/migrations/002_relacion_historica.up.sql) después de Convivencia 001. Si Convivencia 001 ya se aplicó, continuar desde 002.
2. Aplicar [Reportes 002](../backend/services/reportes-service/migrations/002_revision.up.sql) y [Reportes 003](../backend/services/reportes-service/migrations/003_idempotencia.up.sql) en ese orden. Las filas existentes conservan sus datos y quedan con la clave de idempotencia vacía.
3. Configurar `ROOMIES_REPORTES_SQL_PASSWORD`, `REPORTES_CURSOR_SECRET`, `REPORTES_LISTADO_JWT_KEY`, `REPORTES_MATCH_JWT_KEY` y `REPORTES_CONVIVENCIA_JWT_KEY`. Usar secretos distintos de al menos 32 caracteres. El overlay asigna cada clave interna a Reportes y a su destino, habilita el upstream en el Gateway y muestra el formulario en la web.
4. Levantar la topología local con `docker compose -f docker-compose.local.yml -f docker-compose.convivencia.yml -f docker-compose.reportes.yml up --build`.

El ensayo de integración se ejecuta en Windows desde `roomies-web` con `python -I -B backend/local_stack/run_stack.py --pg-bin "<directorio bin de PostgreSQL>" --reports`. Añadir `--progressive` para ensayar también las tablas heredadas en `haycupo`. El runner crea su propia base, sus roles y un proveedor de identidad ficticio en loopback.

La [revisión administrativa de SCRUM-96](SCRUM-96-revision-de-reportes.md) añade la migración 002 y la configuración del aviso `reporte_actualizado` al overlay. Las migraciones quedan preparadas para aplicar en el entorno de despliegue tras revisar el esquema y respaldarlo.
