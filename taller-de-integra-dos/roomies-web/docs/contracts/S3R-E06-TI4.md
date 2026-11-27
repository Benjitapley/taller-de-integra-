# E06 · Entrega de contratos para TI4

Fecha de revisión: 27/11/2026. Backend TEST publicado: Gateway `5af51a9`, demás servicios `eca8822`; [versiones y digests](../evidence/E06/images.json). Las [huellas de fuentes](../evidence/E06/sources-sha256.json) identifican el cliente revisado. La aceptación física sigue pendiente.

Gateway TEST: `https://roomies-gateway-test.inf.uct.cl`. Expo usa `EXPO_PUBLIC_API_URL`; Next usa ese mismo origen en el servidor mediante `FASTAPI_ORIGIN` y `WEB_AUTH_FASTAPI_ORIGIN`. El navegador web usa `/web-api/*` y cookie; Expo envía Bearer mediante su cliente HTTP. Supabase se usa para Auth/Storage; la BD de negocio es PostgreSQL de Kubero.

## Ejemplos y diferencias de despliegue

- [Respuestas sanitizadas obtenidas del Gateway](../evidence/E06/hosted-readonly.json): perfil, catálogo y listas privadas. Conservan cursores reales y las claves de los DTO; textos y fotos personales se redactan. No contienen JWT de sesión.
- [Convivencia ejecutada en PostgreSQL efímero](../evidence/E06/convivencia-executed.json): arriendo, integrantes, conversación, historial, envío, tareas, asignación, completado y retiro; incluye errores y cursores emitidos por FastAPI. Auth y puertos externos están inyectados; no acredita F01 integrado ni Kubero.
- [OpenAPI del servicio probado](../evidence/E06/convivencia.openapi.json) y [solicitudes repetibles](S3R-E06.http).
- Publicaciones e imágenes: [entrega E01](S3R-E01-TI4.md) y [OpenAPI de Listado](publicaciones.openapi.json). Perfil y reportes: [perfil final](../SCRUM-111-perfil-final.md), [reportes](../SCRUM-113-reportes-web.md) y [moderación](../SCRUM-114-panel-reportes.md).

La [consulta posterior al despliegue](../evidence/E06/hosted-after.json) devuelve 200 para `/api/reportes/mios` y `/api/conversaciones` incluye `siguiente_cursor`. La [consulta anterior](../evidence/E06/hosted-readonly.json) conserva el diagnóstico inicial. Se verificaron envíos reales de reporte y chat e imágenes persistidas desde Expo web. El Gateway permite `Idempotency-Key` en CORS para los orígenes locales Expo configurados.

## Rutas del recorrido

| Grupo | Solicitudes del Gateway | Entrada/permiso relevante |
|---|---|---|
| Cuenta | `POST`, `GET`, `PATCH /api/usuarios/me` | Nombre y nacimiento en inicialización; PATCH solo campos editables. Sesión del proveedor, sin ID de actor en cuerpo. Alias `/usuarios/me` continúa en el adaptador móvil actual. |
| Foto | `PUT /api/usuarios/me/foto` | Multipart `foto`; PNG/JPEG/WebP real, máximo 5 MB (5.000.000 bytes). Conservar la anterior hasta confirmación; consultar URL desde otro cliente. |
| Catálogos | `GET /api/regiones`, `GET /api/regiones/{id}/comunas` | Arreglos completos acotados; no cursor. UI de publicación limitada a La Araucanía, con IDs del catálogo. |
| Publicaciones | `GET /api/publicaciones`, `GET /api/publicaciones/mias`, `GET /api/publicaciones/{id}/detalle` | Página pública y propia; detalle admite sesión opcional. El alias `/{id}` conserva restricciones de propietario. Precio entero CLP; `cupos_disponibles` es filtro exacto. |
| Crear/editar/cerrar | `POST /api/publicaciones`, `PUT /api/publicaciones/{id}`, `PATCH /api/publicaciones/{id}/cerrar` | Multipart en crear/editar; solo Arrendador. IDs geográficos y hasta cinco imágenes de 5 MB (5.000.000 bytes cada una). Solo dueño edita/cierra. |
| Postulaciones | `POST /api/publicaciones/{id}/postulaciones`, `GET /api/postulaciones/mias`, `GET /api/publicaciones/{id}/postulantes` | Confirmado y aviso ajeno; listas privadas paginadas. **Enviar `limite=20`**: sin parámetros las rutas de postulaciones conservan el arreglo de compatibilidad. |
| Decisión/retiro | `PATCH /api/postulaciones/{id}/estado`, `POST /api/postulaciones/{id}/retiro` | Dueño decide; postulante retira. Aceptar solo tras preselección; la incorporación usa clave estable y solo se confirma con resultado persistido. Véase contrato de incorporación. |
| Arriendo | `GET /api/arriendos/mio`, `GET /api/arriendos/{id}`, `GET /api/arriendos/{id}/integrantes` | Integrante activo o dueño según operación. Último retiro finaliza; un retirado pierde acceso activo. |
| Chat | `GET /api/conversaciones`, `GET /api/conversaciones/{id}`, `GET/POST /api/conversaciones/{id}/mensajes` | Solo convivencia activa. POST `{contenido,id_cliente}`; mismo UUID al reintentar. Historial excluye mensajes anteriores al ingreso. |
| Tareas | `GET/POST /api/arriendos/{id}/tareas`, `PATCH /api/tareas/{id}`, `PATCH /api/tareas/{id}/estado` | Crear `{titulo,descripcion?,id_asignado?}`; asignar `{id_asignado}`; completar `{estado:"Completada"}` solo por asignado activo. |
| Reportes | `POST /api/reportes`, `GET /api/reportes/mios` | `{categoria,descripcion,id_publicacion_reportada}` o `id_usuario_reportado`, exactamente uno. Persona requiere conexión aceptada o convivencia histórica. Clave de envío estable para reintentar. |
| Notificaciones | `GET /api/notificaciones` | Página propia de resultados, retiro y revisión; no usar la lista antigua con tope fijo. |
| Administración web | `GET /api/admin/reportes`, `GET/PATCH /api/admin/reportes/{id}` | Rol administrador confirmado en servidor; filtro `estado,tipo`, cambio de estado y nota interna. No se exige cliente administrativo móvil. |

## Paginación D06

Usar `limite` entre 1 y 100 (20 por defecto), `cursor` opaco y respuesta `{items,siguiente_cursor}`. El historial de mensajes usa **`antes`**, no `cursor`, para pedir mensajes anteriores; mantiene orden cronológico al mostrar cada página. Tareas añade `id_usuario_actual`. Integrantes añade `puede_retirar`.

Guardar el cursor devuelto junto al contexto de cuenta/filtros/recurso. No construirlo ni interpretar su contenido. Cambiar filtros, publicación o sesión reinicia filas y cursor y descarta respuestas atrasadas. No convertir cursores a offsets. La última página devuelve `null`; no pedir otra página. Un error recuperable conserva filas, cursor y selección; reintentar repite la página fallida. Bloquear cargas duplicadas antes de enviar, además de deshabilitar el botón visualmente.

| Lista | Orden comprobado |
|---|---|
| Catálogo/propias | Fecha de publicación DESC, ID DESC |
| Mis postulaciones/postulantes | Fecha de postulación DESC, ID DESC; autorización/filtros antes del límite |
| Reportes propios/administrativos | Fecha DESC, ID DESC; filtros administrativos antes del límite |
| Historial | Fecha de envío y ID; cursor de mensajes anteriores; corte por ingreso |
| Tareas | Fecha de creación DESC, ID DESC; estado/asignado antes del límite |
| Integrantes | Fecha de ingreso ASC, ID de pertenencia ASC; solo activos antes del límite |
| Notificaciones | Fecha DESC, ID DESC; tipos admitidos antes del límite |
| Conversaciones | ID ASC; pertenencia activa antes del límite. D02 acota actualmente a una. |

## Errores que el cliente debe conservar

401: sesión ausente/inválida; 403: permiso o relación; 404: recurso/mi arriendo ausente; 409: conflicto/transición; 413/415: subida; 422: campos/cursor; 429: tasa; 503: dependencia. El error real de Convivencia usa `{detail,code}` y añade `codigo:"sin_permiso"` en 403. Reportes usa `{codigo,mensaje,detalles?}`; Listado también puede usar `detail`. Validar el HTTP y el cuerpo; no anunciar éxito por un JSON cualquiera. Las diferencias de error del contrato histórico siguen visibles y no deben confundirse con aceptación del candidato.
