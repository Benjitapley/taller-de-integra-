
# Matriz de Integración Móvil — Sprint 3 (M4S3-B01)

* **Alcance vigente:** TI2 v1.4 (solo publicación Arrendador, sin Compartida, sin búsqueda de personas, sin Realtime, sin recordatorios).
* **Autenticación:** Supabase Auth + Bearer JWT vía src/services/httpClient.ts hacia el Gateway común.
* **Paginación estándar:** limite (por defecto 20, rango 1–100), cursor validado y respuesta { items, siguiente_cursor }. Chat usa antes / limite.

## 1- Matriz de endpoints por módulo

### Cuenta y Perfil (Gustavo — A01, A02, A03)

| Método | Ruta | Paginación | Errores esperados | Notas / DTO |
| --- | --- | --- | --- | --- |
| POST | /api/usuarios/me | No | 401, 403, 422, 503 | Provisión idempotente (nombre, fecha_nacimiento) |
| GET | /api/usuarios/me | No | 401, 404, 503 | Consulta de perfil real |
| PATCH | /api/usuarios/me | No | 401, 422, 503 | Solo campos editables; null borra; campos protegidos dan 422 |
| PUT | /api/usuarios/me/foto | No | 401, 422, 413, 503 | Multipart foto (JPEG/PNG/WebP, máx. 5 MB) -> { foto_perfil } |

### Catálogo, Publicaciones y Búsqueda (Javier — B02, B03; Abdiel — C01, C02)

| Método | Ruta | Paginación | Errores esperados | Notas / DTO |
| --- | --- | --- | --- | --- |
| GET | /api/regiones | No | 503 | Catálogo de regiones |
| GET | /api/regiones/{id}/comunas | No | 404, 503 | Selector La Araucanía con IDs del catálogo |
| GET | /api/publicaciones | Cursor | 422, 503 | Filtros: cupos_disponibles exacto, región/comuna, precio CLP 0..999999999999 |
| GET | /api/publicaciones/{id} | No | 404, 503 | Detalle completo (imágenes, reglas, autor, estado) |
| GET | /api/publicaciones/{id}/cupos | No | 404, 503 | Cupos reales desde API |
| POST | /api/publicaciones | No | 401, 403, 422, 503 | Multipart, hasta 5 fotos (5 MB c/u), solo Arrendador, éxito 201 |
| GET | /api/publicaciones/mias | Cursor | 401, 503 | Publicaciones propias del arrendador |
| PUT | /api/publicaciones/{id} | No | 401, 403, 409, 422 | Edición preservando IDs de fotos y añadiendo nuevas |
| PATCH | /api/publicaciones/{id}/cerrar | No | 401, 403, 409 | Cierra aviso y cancela solicitudes abiertas |

### Postulaciones y Postulantes (Abdiel — C03, C04)

| Método | Ruta | Paginación | Errores esperados | Notas / DTO |
| --- | --- | --- | --- | --- |
| POST | /api/publicaciones/{id}/postulaciones | No | 401, 403, 409 | 409 si duplicada/sin cupos/ya miembro |
| GET | /api/postulaciones/mias | Cursor | 401, 503 | Lista de postulaciones propias |
| GET | /api/postulaciones/{id} | No | 401, 403, 404 | Detalle de postulación |
| POST | /api/postulaciones/{id}/retiro | No | 401, 403, 409 | Retiro permitido en Pendiente / Preseleccionada |
| GET | /api/publicaciones/{id}/postulantes | Cursor | 401, 403, 404 | Solo dueño; lista paginada y filtrada |
| PATCH | /api/postulaciones/{id}/estado | No | 401, 403, 409, 422 | Preseleccionar, aceptar o rechazar |

### Convivencia, Chat, Tareas y Retiro (Matías — D01, D02, D03; Javier — B04)

| Método | Ruta | Paginación | Errores esperados | Notas / DTO |
| --- | --- | --- | --- | --- |
| GET | /api/arriendos/mio | No | 401, 404, 503 | Pertenencia activa del usuario |
| GET | /api/arriendos/{id} | No | 401, 403, 404 | Detalle del arriendo activo |
| GET | /api/arriendos/{id_arriendo}/integrantes | Cursor | 401, 403, 404 | Confirmado por TI2: accesible para residentes y dueño no residente (M4S3-B04 / D01) |
| POST | /api/arriendos/{id}/expulsiones | No | 401, 403, 409, 422 | Solo dueño; motivo 1–500 caracteres |
| GET | /api/conversaciones | No | 401, 403, 503 | Conversaciones del arriendo |
| GET | /api/conversaciones/{id} | No | 401, 403, 404 | Detalle de conversación |
| GET | /api/conversaciones/{id}/mensajes | antes/limite | 401, 403, 404 | Historial hacia atrás desde fecha de ingreso |
| POST | /api/conversaciones/{id}/mensajes | No | 401, 403, 422 | Texto 1–2000 + UUID id_cliente para idempotencia |
| GET | /api/arriendos/{id}/tareas | Cursor | 401, 403, 404 | Lista de tareas con filtros |
| POST | /api/arriendos/{id}/tareas | No | 401, 403, 422 | Título 1–120, descripción hasta 1000, asignado activo o null |
| PATCH | /api/tareas/{id} | No | 401, 403, 422 | Editar / reasignar tarea |
| PATCH | /api/tareas/{id}/estado | No | 401, 403, 409 | Solo asignado activo completa |

### Reportes y Notificaciones (Gustavo — A04, A05)

| Método | Ruta | Paginación | Errores esperados | Notas / DTO |
| --- | --- | --- | --- | --- |
| POST | /api/reportes | No | 401, 403, 422 | 1 objetivo (usuario o publicación), categoría, desc 1–1000 |
| GET | /api/reportes/mios | Cursor | 401, 503 | Reportes propios sin notas administrativas |
| GET | /api/notificaciones | Cursor | 401, 503 | Avisos de postulación, retiro y reporte |

## 2- Ejemplos JSON (Request / Response)

### Ejemplo: GET /api/publicaciones (Respuesta paginada)

{
"items": [
{
"id": 1,
"titulo": "Habitación en Temuco Centro",
"precio": 220000,
"cupos_disponibles": 2
}
],
"siguiente_cursor": "eyJpZCI6MX0="
}

## 3. Decisiones y divergencias abiertas

1. **Lectura de integrantes para dueño no residente (M4S3-B04):**
* *Acuerdo:* TI2 confirmó que el endpoint para consultar integrantes (tanto para residentes como para dueño no residente) es GET /api/arriendos/{id_arriendo}/integrantes.
* *Estado:* **Resuelto**.


2. **Campo confirmo vs. confirmar:**
* *Problema:* El contrato PDF indica confirmo, mientras que la PR #37 usa confirmar.
* *Acción:* El móvil implementará el nombre exacto que quede publicado en el anexo contractual.
* *Estado:* Pendiente de confirmación TI2.


3. **Estado actual de src/services/publicacionesService.ts en main:**
* La creación ya utiliza POST /api/publicaciones (multipart) mediante solicitarFormulario.
* Listado y detalle conservan publicacionesMock hasta que se ejecuten M4S3-B02 y M4S3-B03.