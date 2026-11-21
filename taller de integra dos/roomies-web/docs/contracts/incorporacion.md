# Incorporación v1 - base inicial de Convivencia (TI2)

Aplicada el **18 de noviembre de 2026**, America/Santiago, en
`taller de integra dos/roomies-web`, rama local `dev-web`.
Base: `616747fa15692d65278b7b31e200f892eba85ac3`.

**Estado: base ejecutable y propuesta de contrato listas para revisión.
Firmas, proveedores reales e integración de admisión pendientes.**
Jira queda a cargo de Benjamín, según su instrucción. No se creó PR ni se hizo push.

## Alcance y trazabilidad

Referencias de la tarea: **FR-46/49/50/53; BR-11/15/16; contrato 8.3**.
No se encontró su texto completo ni el acta de decisiones D en esta carpeta.
No se asigna a esos códigos una definición inventada ni se declara cumplimiento
del requisito completo. Las decisiones D ratificadas prevalecen en este release;
si contradicen esta propuesta, se ajustan contrato y pruebas antes de integrarla.

El recorte incluye API, persistencia propia, índices, idempotencia, puertos y
recuperación. No incluye chat, tareas, reglas, salidas/expulsiones ni reputación.
Listado conserva `incorporacion_pendiente: true` al aceptar una postulación:
aceptar todavía no llama automáticamente a Convivencia.

El encargo asigna a Benjamín tres de las cinco horas iniciales de Larenas,
revisión de pruebas/decisiones el 17 e insumo para F01 desde el 18. Es planificación
aportada por la tarea, no certificación de horas ni de una revisión ya realizada.
Esta reaplicación corresponde al 18 y no acredita retroactivamente el hito del 17.

## Responsabilidad de cada dominio

| Dominio | Autoridad y responsabilidad |
| --- | --- |
| Identidad / Auth | Sesión, subject UUID -> id_usuario entero y habilitación/correo del destinatario. |
| Listado | Publicación, propietario, postulación aceptada, capacidad declarada, versión y reserva firme de cupo. |
| Convivencia: pertenencia | Un arriendo por publicación, una pertenencia activa por usuario y autorización de lectura. |
| Convivencia: ocupación | Pertenencias activas, control local de capacidad, ledger de incorporación y outbox. |

Una reserva pendiente ya retiene cupo en Listado. Confirmarla la transforma en
asignación de la misma operación: no se suma dos veces. El propietario de la
publicación no se incorpora automáticamente ni recibe acceso solo por ser dueño.

Los IDs de usuario, publicación, postulación y arriendo son enteros positivos
de negocio, hasta BIGINT. El subject de autenticación es UUID y no se confunde
con id_usuario. Las únicas FK y consultas SQL pertenecen al esquema propio
`convivencia_mensajeria`; nunca se consultan tablas de otro dominio.

## API de Convivencia

### POST /internal/incorporaciones

Solo por red interna; el gateway público no publica esta ruta.
Cabeceras: `Content-Type: application/json`, `X-Roomies-Service` (secreto ASCII
de al menos 32 caracteres), `Idempotency-Key` (UUID estable de la operación).
Listado persiste una clave por postulación antes de llamar y la conserva en
todos los reintentos. No se genera otra UUID por timeout.

```json
{"id_postulacion":901,"id_publicacion":71,"id_usuario":22,"version_capacidad":1}
```

Se rechazan campos extra, booleanos y números como texto. Respuesta 201:

```json
{
  "id_incorporacion":"3b45a6ec-3c30-4555-a60a-fb54646328d9",
  "id_arriendo":1,
  "id_publicacion":71,
  "id_usuario":22,
  "estado":"Activa",
  "confirmacion_publicacion":"Pendiente"
}
```

La UUID de incorporación es la Idempotency-Key. El recibo se persiste y se
reproduce exactamente en un reintento. `Idempotency-Replayed: false` identifica
el primer resultado; `true`, el replay. `Pendiente` describe la confirmación
externa al momento de guardar el recibo; la reserva ya debe ser firme.
La entrega posterior de outbox no modifica ese cuerpo original.

Misma clave y otro cuerpo: 409 `IDEMPOTENCY_CONFLICT`. Otra clave para la misma
postulación no crea otra pertenencia. Los errores definitivos se conservan;
los errores transitorios 503 dejan la operación pendiente para reanudarla.

### GET /api/arriendos/mio y GET /api/arriendos/{id}

Requieren Bearer JWT válido y correo confirmado mediante el verificador y
puerto de Identidad existente. `mio` se registra antes de la ruta numérica.
Un usuario solo puede leer un arriendo si tiene pertenencia activa; para otro
arriendo o sin pertenencia recibe 404. Ejemplo ficticio de respuesta 200:

```json
{"id_arriendo":1,"id_publicacion":71,"cupos_totales":2,"version_capacidad":1,"ocupacion":1}
```

Las respuestas llevan `Cache-Control: no-store`. Payloads y esquemas de respuesta
quedan congelados en `incorporacion.openapi.json`, exportado desde la aplicación.

| HTTP | code estable | Caso |
| --- | --- | --- |
| 401 | UNAUTHENTICATED | Falta sesión o JWT no válido en GET. |
| 403 | FORBIDDEN | Credencial de servicio inválida o correo sin confirmar. |
| 403 | USER_NOT_ENABLED | Destinatario no habilitado. |
| 404 | RENTAL_NOT_FOUND | Arriendo inexistente o sin pertenencia activa. |
| 409 | USER_ALREADY_ACTIVE | Ya pertenece a un arriendo. |
| 409 | APPLICATION_ALREADY_PROCESSED | Postulación ya incorporada. |
| 409 | IDEMPOTENCY_CONFLICT | Clave reutilizada con otro cuerpo. |
| 409 | NO_CAPACITY | Último cupo ocupado/reservado. |
| 409 | CAPACITY_VERSION_CONFLICT | Versión o capacidad incompatible. |
| 409 | APPLICATION_NOT_ACCEPTED / PUBLICATION_CLOSED | Reserva rechazada por Listado. |
| 422 | INVALID_REQUEST | Cuerpo, ruta o cabecera inválidos. |
| 503 | DEPENDENCY_UNAVAILABLE | DB, configuración o proveedor no disponibles. |

Forma de error de negocio: `{"detail":"Mensaje sanitizado.","code":"NO_CAPACITY"}`.
El consumidor decide por `code`, no comparando frases. Los límites compartidos
de transporte pueden devolver 408/413 con su formato heredado `{detail}`.

## Puertos por acordar antes de integrar F01

Estos proveedores **no se implementan en Auth/Listado en este recorte**. Un
endpoint ausente, una respuesta inválida o un timeout cierran con 503; no se
inventan habilitación, cupos ni pertenencias.

**Identidad:** `GET /internal/v1/usuarios/{id}/habilitacion`, con
`X-Roomies-Service`. Respuesta 200 estricta:
`{"id_usuario":22,"habilitado":true}`. Debe comprobar habilitación de negocio
y correo según el acta D. Un perfil público existente no basta.

**Reserva de Listado:** `POST /internal/publicaciones/{id}/reservas`, con
`X-Roomies-Service` e `Idempotency-Key`. Cuerpo: los cuatro campos de incorporación
más `id_operacion` UUID. Respuesta: esos cuatro campos, `id_reserva` UUID y
`cupos_totales` entero positivo, coherentes con la solicitud.

Listado verifica postulación aceptada, usuario, publicación habilitada, versión
y capacidad en una única transacción propia. Bloquea publicación y cuenta
asignaciones más reservas pendientes. De dos pedidos por el último cupo solo
concede uno. Cambios de capacidad/estado aumentan una versión monotónica;
una reducción/cierre incompatible con reservas vigentes se rechaza con 409.

Confirmación: `PUT /internal/publicaciones/{id}/reservas/{id_reserva}/confirmacion`.
Liberación: `DELETE /internal/publicaciones/{id}/reservas/{id_reserva}`.
Ambas conservan la UUID y credencial internas; repetir una transición ya aplicada
devuelve 2xx. No se libera una reserva confirmada. La deduplicación distingue
método/recurso o estados de reserva, para no confundir un POST con su confirmación.
Las reservas son firmes: no expiran unilateralmente después de un timeout.

El arriendo local congela la capacidad/versión de la primera admisión. Actualizar
ese snapshot requiere un protocolo posterior, fuera de este alcance.

## Persistencia y recuperación

La migración inicial requiere un migrador autorizado y un rol dedicado
`sql_convivencia_mensajeria`, sin privilegios administrativos ni heredados.
No se ejecuta al arrancar ni altera datos existentes. El rollback es destructivo,
solo para un entorno vacío/desechable o una restauración explícita con respaldo.

Se revisan: UNIQUE de publicación en arriendo; UNIQUE parcial de usuario con
pertenencia Activa; UNIQUE de postulación y operación en pertenencia; PK UUID
del ledger; restricciones positivas de capacidad/versión; trigger de cupo y
permisos del rol. Los bloqueos serializan usuario, publicación, postulación y
fila de arriendo. La ocupación se comprueba dentro de la transacción.

Secuencia: guardar operación -> validar identidad -> guardar intención de
reservar -> reservar por HTTP -> transacción local de arriendo/pertenencia,
recibo y outbox -> responder. Si se pierde la reserva remota antes del commit,
se vuelve a pedir con la misma clave. La intención persistida obliga a resolver
esa reserva incluso si luego se deshabilita al usuario; se encola su liberación.
Si se pierde el 201, el replay devuelve el recibo original. La outbox confirma
o libera de forma idempotente; los lotes rotan por último intento para evitar
que fallos antiguos posterguen indefinidamente las operaciones posteriores.

## Casos y aceptación

Los ejemplos usan datos ficticios. Usuario ya activo: se espera 409
`USER_ALREADY_ACTIVE` y compensación de una reserva previa. Último cupo: dos
solicitudes concurrentes deben producir un 201 y un 409 `NO_CAPACITY`, una
pertenencia y un arriendo. Reintento: mismo cuerpo/clave devuelve el resultado
guardado; otro cuerpo con igual clave produce 409 `IDEMPOTENCY_CONFLICT`.

La evidencia distingue pruebas con puertos simulados, pruebas SQL reales e
integración con proveedores todavía pendiente. Para mover
admisión a Terminado se requieren esquema/índices ensayados, casos exigidos
aprobados, proveedores reales, revisión de contrato con Listado, decisiones D
ratificadas y firmas/evidencias reales. Una carpeta o health no cumplen el criterio.

| Parte | Responsabilidad de revisión | Estado |
| --- | --- | --- |
| Benjamín | Base inicial, pruebas y entrega del reemplazo | Preparación técnica; no se atribuye firma humana. |
| Listado | Payloads, errores y protocolo de reservas | Pendiente de aprobación/firma. |
| Larenas | Decisiones D, pruebas y aceptación del recorte | Pendiente de aprobación/firma. |

Resultados sanitizados y entorno: `incorporacion.evidencia.md`. SHA base y
hashes de archivos: `incorporacion.manifest.json`. Benjamín gestiona Jira;
PR no creado. **Estado final del recorte: base preparada, admisión integrada pendiente.**
