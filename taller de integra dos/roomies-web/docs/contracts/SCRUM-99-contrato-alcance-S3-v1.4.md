# SCRUM-99 · Matriz preliminar de contrato y desviaciones Sprint 3 v1.4

**Estado:** BORRADOR PARA REVISIÓN. **Corte:** 18/11/2026. **Relación:** Jira SCRUM-99 ↔ S3R-B01. **PR:** [#42](https://github.com/Benjitapley/taller-de-integra-/pull/42), sobre `dev-web`.

> **Advertencia de trazabilidad.** Este documento **no es el Contrato de Microservicios v1.0 del 08/11/2026**, ni acredita conformidad de TI4. Es un inventario de reglas objetivo y una matriz preliminar basada en *Roomies_Backlog_TI2_Sprint3_v1.4.pdf* (pp. 5, 7–8, 15–16) y la auditoría local de Codex del 18/11. Los **DTO completos, las rutas efectivas y los errores no explícitos deben verificarse** contra el contrato original, el código y OpenAPI de cada servicio antes de publicar una versión canónica.

## 1. Fuentes y orden de precedencia

1. Decisiones funcionales explícitas del 14/11/2026.
2. Backlog técnico Sprint 3 v1.4 del 15/11/2026, especialmente D06 y D08–D12.
3. Contrato de Microservicios v1.0 del 08/11/2026, **pendiente de comparación directa**.
4. MER vigente, **pendiente de versión/hash y reconciliación**.
5. SRS 1.4 y backlog anterior, solo para trazabilidad.

El backlog acota el *release*; no todos los endpoints del contrato más amplio quedan comprometidos.

## 2. Matriz preliminar método / ruta / DTO / errores / servicio

La columna actual describe los routers del worktree en `8b9611e`. La columna objetivo recoge el backlog v1.4. Los consumidores indicados son clientes afectados por el contrato; su integración efectiva requiere verificación por cliente.

| Servicio responsable | Método y ruta actuales | Método y ruta objetivo | DTO o estructura actual | DTO o estructura objetivo | Errores conocidos o requeridos | Consumidores afectados | Estado y evidencia del código |
|---|---|---|---|---|---|---|---|
| Listado/Applications | `GET /api/publicaciones` y `GET /api/publicaciones/buscar` | `GET /api/publicaciones` | Arreglo de publicaciones con `id`, `titulo`, `precio`, `cupos_totales` y `cupos_disponibles` entre otros campos. Este último admite `null`. Consulta por `cupos_min`, `limite` (100 por defecto) y `offset`. | Página D06. Filtro D10 `cupos_disponibles=n` por igualdad con la disponibilidad real. | Actual: validación de parámetros por FastAPI. Objetivo: 422 al combinar ambos filtros de cupos. | Next.js y Expo | Ruta presente. El router devuelve una lista por comprensión; faltan filtro exacto y cursor. [Router de Listado](../../backend/services/listado-applications-service/app/api/routes.py) |
| Listado/Applications | `GET /api/mis-publicaciones` | `GET /api/publicaciones/mias` | Arreglo del mismo DTO, filtrado por el usuario confirmado. | Página D06 de publicaciones propias. | Requiere actor confirmado. Códigos objetivo pendientes de cotejo. | Next.js y Expo | Ruta actual distinta. Ver función `mine` en el router de Listado. |
| Listado/Applications | `GET /api/postulaciones/mias` | `GET /api/postulaciones/mias` | Arreglo de filas de postulación del actor con título y estado de la publicación; consulta limitada a 100. | Página D06 de postulaciones propias. | Aplicar permisos antes de paginar. | Next.js y Expo | Ruta presente sin cursor. [Repositorio de Listado](../../backend/services/listado-applications-service/app/infrastructure/repository.py) |
| Listado/Applications | `GET /api/publicaciones/{id}/postulantes` | `GET /api/publicaciones/{id}/postulantes` | Arreglo de filas de postulación de la publicación, limitado a 100. | Página D06 de postulantes; campos canónicos pendientes. | Actor confirmado y comprobación del dueño antes de consultar. | Next.js y Expo | Ruta presente sin cursor. [Servicio de Listado](../../backend/services/listado-applications-service/app/application/service.py) |
| Reportes | Sin ruta acreditada | `GET /api/reportes/mios` | Sin DTO acreditado | Página D06 de reportes propios, sin detalles privados internos. | Acceso limitado al actor. Códigos pendientes. | Next.js y Expo | Objetivo A03/D06. |
| Reportes | Sin ruta acreditada | `GET /api/admin/reportes` | Sin DTO acreditado | Página D06, filtros de estado/tipo. | 401 sin token y 403 para usuario común según A04. | Next.js (administración) | Objetivo A04/D06. |
| Convivencia/Mensajería | Sin ruta acreditada | `GET /api/conversaciones/{id}/mensajes` | Sin DTO acreditado | Historia hacia atrás con `antes` y `limite`. DTO individual por verificar. | Membresía activa y límite por fecha de ingreso. | Next.js y Expo | Objetivo D03/D06. |
| Convivencia/Mensajería | Sin ruta acreditada | `GET /api/arriendos/{id}/tareas` | Sin DTO acreditado | Página D06 con filtros de estado/asignado. | Restringir a integrantes activos. | Next.js y Expo | Objetivo D04/D06. |
| Convivencia/Mensajería | Sin ruta acreditada | `GET /api/arriendos/{id}/integrantes` | Sin DTO acreditado | Página D06 con filtro de integrantes activos. | Aplicar permisos antes de paginar. | Next.js y Expo | Objetivo D06. |
| Auth/Users | `POST /local/v1/perfil/inicializacion` | `POST /api/usuarios/me` | Recibe nombre y fecha de nacimiento; devuelve `id_usuario` e `inicializado`. | Inicialización idempotente. DTO canónico por cotejar. | Identidad válida y correo confirmado. | Next.js y Expo | Operación local implementada. [Router de usuarios local](../../backend/services/auth-users-service/app/api/routes/local_users.py) |
| Auth/Users | `GET /usuarios/me` y `GET /local/v1/perfil` | `GET /api/usuarios/me` | `ProfileResponse` incluye nombre, edad, ocupación, ciudad, descripciones y foto. La ruta local devuelve además `verificado` y `edad_calculada`. | Perfil privado del actor. DTO canónico por cotejar. | Ruta provisional: 404 por perfil ausente o ajeno, 503 si falla el repositorio. | Next.js y Expo | Dos contratos de lectura. [Router provisional](../../backend/services/auth-users-service/app/api/routes/profiles.py) y [modelo de perfil](../../backend/services/auth-users-service/app/schemas/profile.py). |
| Auth/Users | `PATCH /usuarios/me` y `PATCH /local/v1/perfil` | `PATCH /api/usuarios/me` | La ruta provisional recibe `ProfilePatchRequest` y devuelve `ProfileResponse`. La local usa `LocalProfilePatch` y devuelve la proyección pública del perfil. | Actualización de campos editables; nombre, correo y nacimiento protegidos. DTO pendiente. | Provisional: 422, 404 y 503. Local: 403 por correo sin confirmar. | Next.js y Expo | Entradas distintas: el PATCH provisional admite edad y el local admite presupuesto y zona de interés. Ver ambos routers de Auth/Users. |
| Auth/Users | `PUT /local/v1/perfil` (formulario de perfil con foto opcional) | `PUT /api/usuarios/me/foto` | Formulario multipart; devuelve `success`. | Campo multipart `foto`, JPEG/PNG/WebP, máximo 5 000 000 bytes. Respuesta con `foto_perfil`. | Local: 403 por correo sin confirmar, 422 por campos inválidos. Objetivo: validar contenido y propietario. | Next.js y Expo | La ruta local usa `Images`. La operación dedicada con Supabase Storage requiere evidencia propia. |

**Página D06.** El objetivo general usa `limite=20` por defecto (rango 1–100), `items` y `siguiente_cursor` nulo al finalizar. Validar el cursor opaco contra los filtros y el contexto del actor, aplicar permisos antes de paginar y ordenar con desempate por ID. En publicaciones, el orden es fecha de publicación e ID descendentes. Un cambio de cuenta o de filtro reinicia la consulta. Mensajes usa la variante `antes` descrita en su fila.

### Instrucciones de reconciliación para esta tabla

- Completar los DTO y errores pendientes al cotejar el contrato del 08/11 y el OpenAPI de cada servicio. Registrar versiones y resultados de pruebas de los clientes por operación.
- Adjuntar **nombre y versión del contrato** efectivamente aprobado por el equipo, SHA/fecha del OpenAPI y matriz de compatibilidad con Expo.
- Registrar alias transitorios de web y Expo antes de eliminarlos.
- No presentar los servicios Convivencia/Reportes como desplegados solo porque el contrato los contempla.
- **No modificar rutas ni DTO automáticamente por completar esta tabla**; las funcionalidades pendientes tienen responsables y tickets propios.

## 3. Decisiones que deben versionarse

| Decisión | Exigencia exacta del backlog | Impacto en contrato / consumidores | Estado en SCRUM-99 |
|---|---|---|---|
| **D06** | `limite` por defecto 20, rango 1–100; `cursor` opaco; respuesta `items`, `siguiente_cursor`; orden estable por fecha/ID. | Cambiar listados crecientes y adaptar web/Expo; cursar el cambio en OpenAPI. | Documentado, **sin garantía de implementación**. |
| **D08** | PostgreSQL de negocio en Kubero; Supabase Auth se conserva; decidir host de los procesos con pruebas de red/permisos. | DSN/roles por dominio, separación Auth/negocio, despliegue y persistencia. | Depende de B02/B03. |
| **D09** | Preservar datos e identidades reales al migrar a PostgreSQL Kubero. Una base de demostración vacía no cumple el criterio. | Registrar continuidad de identidades y datos por dominio. | Ejecución y evidencia operativa a cargo de S3R-B03. |
| **D10** | Filtro objetivo `cupos_disponibles=n` por igualdad sobre cupos reales disponibles (pp. 20 y 27). Durante la transición, combinarlo con `cupos_min` debe devolver HTTP 422. | Coordinar el parámetro, OpenAPI y ambos clientes. | Hoy se implementa el filtro `cupos_min`; el campo de salida `cupos_disponibles` puede ser `null`. La igualdad por disponibilidad real sigue pendiente. |
| **D11** | Selectores de web/Expo ofrecen comunas de **La Araucanía**; catálogo nacional y publicaciones existentes continúan admitidos por API; validar comuna/región. | UI, catálogos y validaciones de Listado. | Pendiente de verificar en ambos clientes. |
| **D12** | Precio CLP entero en `[0, 999999999999]`, sin fracciones; BD `bigint` o `numeric(12,0)` y validación previa; no redondear datos existentes. | DTO, API `422` **solo donde el contrato lo confirme**, controles UI, migración y datos antiguos. | No implementado ni auditado en SCRUM-99. |

## 4. Mapa mínimo de dominio / MER

| Dominio | Propietario | Regla |
|---|---|---|
| Usuario/Notificación | Auth/Users | Identidad externa Supabase; Notificación pertenece a Auth/Users. |
| Región/Comuna y Publicación | Listado/Applications | Región y Comuna pertenecen a Listado. Usuario→Comuna es referencia lógica; Publicación→Comuna interna. |
| Conexión y relación previa | Match/Conexión | Consultas por API; no leer SQL ajeno. |
| Pertenencia activa/Chat/Tareas | Convivencia/Mensajería | Fuente de miembros activos; no confiar solo en copia de cupos de Listado. |
| Reporte/Reporte_Historial | Reputación/Historial/Reportes | Solo Reportes se implementa en este release. |

Alias a resolver por versión de MER/DTO: `id_usuario_reportado`/`id_usuario_objetivo`, `id_responsable`/`id_asignado`, `acepta_mascotas`/`mascota`. **No inventar equivalencias adicionales** sin cotejar el MER.

## 5. Aprobación y entrega a TI4

| Campo | Registro |
|---|---|
| Versión **canónica aprobada** | **PENDIENTE** (este es solo borrador de desviaciones). |
| Documento/fuente del 08/11 contrastado | **PENDIENTE**. |
| OpenAPI actual por servicio y SHA | **PENDIENTE**. |
| Responsable que aprueba API | **PENDIENTE**. |
| Responsable TI4 receptor | **PENDIENTE**. |
| Fecha efectiva de envío/recepción | **PENDIENTE**. |
| Compatibility plan Next.js/Expo | **PENDIENTE**. |
| Evidencia en Jira/PR | **PENDIENTE**. |

**Estado de aceptación:** documentación preliminar preparada; **contrato único no entregado ni aprobado**.
