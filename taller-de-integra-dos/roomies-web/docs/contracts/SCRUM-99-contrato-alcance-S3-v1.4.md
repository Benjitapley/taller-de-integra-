# SCRUM-99 · Contrato de Sprint 3 frente al código de Roomies

**Corte de código:** `013e105`, rama de Jira SCRUM-99, PR #42 hacia `dev-web`. Esta matriz es un documento de trabajo para Next.js y Expo.

## 1. Fuentes y alcance de la comprobación

Referencia contractual vigente recibida del Scrum Master: *Contrato_Microservicios_Roomies_Sprint3_v2_editado.pdf*, fechado el 18/11/2026, 27 páginas. Se revisaron las reglas comunes y formularios (pp. 1–8), las operaciones y DTO de los cinco servicios (pp. 9–23), los intercambios y flujos transaccionales (pp. 24–26) y el almacenamiento de imágenes (p. 27). El backlog v1.4 del 15/11 conserva la trazabilidad de S3R-B01 y D06/D08–D12. El PDF del 08/11 sigue como antecedente histórico pendiente de cotejo. La distribución del documento acredita su procedencia; la aprobación formal, firma y recepción en TI4 carecen de evidencia adjunta.

| Estado | Alcance de la evidencia |
|---|---|
| Implementado y comprobado | Comportamiento concreto visible en el código y, cuando se indica, cubierto por las pruebas locales del anexo. |
| Parcial o incompatible | Hay una operación relacionada, con diferencias de prefijo, método, permisos, DTO o regla de negocio. |
| Pendiente de implementación | El contrato la define y no se encontró la operación canónica en los routers de los servicios revisados en este SHA. |
| No verificado | Falta evidencia de ejecución, configuración, consumo o aceptación en el entorno correspondiente. |

## 2. API pública de Sprint 3

Las tablas comparan el contrato público del Gateway con los caminos disponibles en esta rama, incluidos los alias de laboratorio. Una ruta en un router demuestra implementación estática. La accesibilidad en un despliegue requiere verificar también el enrutado y ejecutar la operación. [Rutas del Gateway](../../backend/api-gateway/app/local_routes.py)

**Reglas comunes.** El contrato pide JWT Supabase, autorización en cada servicio y rol administrativo de `app_metadata.rol`. Para publicar, postular, enviar mensajes y reportar exige correo verificado. Los errores tienen `codigo` y `mensaje`, con `detalles` por campo en 422. Distingue 401 sin identidad válida, 403 por permisos o correo, 404 por ausencia, 409 por conflictos de negocio, 413/415 por imágenes, 422 por validación, 429 por tasa y 503 por dependencia. El código actual también emite respuestas con `detail`; recibir el mismo HTTP no garantiza el mismo DTO de error. Las listas crecientes usan la página D06 (§3).

### 2.1 Auth/Users · pp. 9–11

Registro, renovación, verificación de correo, recuperación y sesión corresponden a Supabase Auth. En el BFF web se comprobó con proveedor simulado la confirmación del enlace original tras repetir el registro (19/19 en la suite). El correo real sigue sin verificar. Estas operaciones de identidad son distintas de inicializar el perfil de negocio.

| Contrato público | Permiso, entrada y respuesta requeridos | Implementación observada y estado |
|---|---|---|
| `POST /api/usuarios/me` | Tras verificar correo, nombre y fecha de nacimiento; crea o devuelve el perfil idempotentemente. Menor de edad: 422. | **Parcial.** `POST /local/v1/perfil/inicializacion` recibe esos campos y devuelve `id_usuario,inicializado`. |
| `GET /api/usuarios/me` | Sesión; Usuario propio con ID, nacimiento, edad, género, intereses geográficos, foto, correo verificado, calificación nula y total de evaluaciones 0. | **Parcial.** `GET /usuarios/me` usa `ProfileResponse`; `GET /local/v1/perfil` añade `verificado,edad_calculada`. Ambos difieren del DTO canónico. |
| `PATCH /api/usuarios/me` | Sesión; solo campos editables presentes, nulo borra. Cambiar nombre, nacimiento o correo: 422. | **Parcial.** `PATCH /usuarios/me` usa `ProfilePatchRequest` y admite edad; `PATCH /local/v1/perfil` admite presupuesto y zona textual. El contrato usa IDs de región/comuna y los valida. |
| `PUT /api/usuarios/me/foto` | Sesión, multipart `foto`; devuelve `foto_perfil`. | **Parcial.** `PUT /local/v1/perfil` acepta foto opcional junto a campos de perfil y devuelve `success`. Almacenamiento local mediante `Images`. |
| `GET /api/usuarios/{id}` y `GET /api/usuarios` | Detalle anónimo reducido a nombre y foto; búsqueda con correo verificado, cursor y filtros de edad, región, comuna, ocupación y calificación. | **Parcial.** Match expone `GET /conexiones/usuarios/{id}`, `/buscar` y `/otros` bajo el mismo prefijo de usuarios; consulta `/local/v1/usuarios/publicos`. Campos, filtros y controles de acceso distintos. |
| `GET /api/notificaciones` | Sesión; página del actor con `id_notificacion,tipo,referencia_id,fecha`; solo consulta de resultado de postulación, expulsión y actualización de reporte. | **Parcial.** `GET /local/v1/notificaciones` devuelve la consulta del repositorio para el usuario; sin parámetros de cursor. |

Fuentes: [router local](../../backend/services/auth-users-service/app/api/routes/local_users.py), [router de perfil](../../backend/services/auth-users-service/app/api/routes/profiles.py) y [modelos provisionales](../../backend/services/auth-users-service/app/schemas/profile.py).

### 2.2 Listado/Applications · pp. 12–15

| Contrato público | Permiso, entrada y respuesta requeridos | Implementación observada y estado |
|---|---|---|
| `GET /api/regiones`, `GET /api/regiones/{id}/comunas` | Públicos; arreglos completos de ID y nombre; región inexistente: 404. | **Pendiente.** Sin rutas de catálogo en el router de Listado. D11 distingue el catálogo nacional del selector regional. |
| `GET /api/publicaciones` | Público; vigentes con disponibilidad conocida ≥1. DTO con `id_publicacion`, precio entero, región/comuna, autor, imágenes ordenadas y cupos reales. | **Parcial.** Ruta presente. Devuelve arreglo con `id`, ubicación textual, precio convertido a `float`, una `imagen` y cupos que pueden ser nulos. `limite=100` por defecto y `offset`. Véanse D06/D10. |
| `GET /api/publicaciones/{id}`, `GET /api/publicaciones/mias` | Detalle público incluso de cerradas, con reglas y postulación propia según sesión; propias con filtro de estado, cursor e `id_arriendo` para el dueño. | **Parcial.** El detalle público actual termina en `/{id}/detalle`; `/{id}` exige dueño. `GET /api/mis-publicaciones` devuelve un arreglo del actor confirmado. |
| `POST /api/publicaciones`, `PUT /api/publicaciones/{id}` | Crear con correo verificado (201 con publicación Disponible); editar como dueño. Multipart, solo Arrendador, IDs geográficos, reglas y hasta cinco imágenes. 409 por capacidad incompatible o reglas bloqueadas. | **Parcial.** Crear devuelve `id,mensaje`; editar devuelve `mensaje`. El formulario admite una imagen y ubicación textual; el dominio acepta Compartida y precio con decimales. |
| `PATCH /api/publicaciones/{id}/cerrar` | Dueño; cierre idempotente, cancela pendientes/preseleccionadas, conserva miembros e imágenes. | **Parcial.** Existe ruta con control de actor y devolución del DTO local. Coordinación con incorporaciones en curso sin acreditar. |
| `POST /api/publicaciones/{id}/postulaciones` | Correo verificado, sin campos; 201 Pendiente. Propia: 403. Duplicada, cerrada, sin cupo, pertenencia activa o reingreso prohibido: conflictos 409 diferenciados. | **Parcial.** Ruta presente. El servicio usa `UnavailableOccupancy`; la ocupación y pertenencia reales no están acreditadas. |
| `GET /api/postulaciones/mias`, `GET /api/publicaciones/{id}/postulantes` | Postulante o dueño según operación; filtro de estado, permisos previos al cursor. DTO con IDs, estado, motivo, fechas e `id_arriendo` si aceptada. | **Parcial.** Ambas rutas existen. Devuelven filas en arreglo (hasta 100); las propias añaden título y estado de publicación. |
| `GET /api/postulaciones/{id}`, `POST /api/postulaciones/{id}/retiro` | Detalle con historial para postulante o dueño; retiro solo por postulante en Pendiente/Preseleccionada, con motivo fijo. | **Pendiente.** Sin estas operaciones en el router de Listado. |
| `PATCH /api/postulaciones/{id}/estado` | Dueño, estado y motivo opcional ≤500. Aceptación confirmada únicamente después del ingreso; conflicto deja la solicitud Preseleccionada. | **Incompatible.** El DTO admite también Cancelada y motivo de hasta 1000. Al aceptar, la respuesta añade `incorporacion_pendiente`; no prueba pertenencia efectiva. |

Fuentes: [router y DTO](../../backend/services/listado-applications-service/app/api/routes.py), [reglas de publicación](../../backend/services/listado-applications-service/app/domain/publications.py), [servicio](../../backend/services/listado-applications-service/app/application/service.py) y [repositorio](../../backend/services/listado-applications-service/app/infrastructure/repository.py).

### 2.3 Match/Conexión · pp. 16–17

| Contrato público | Permiso y DTO requeridos | Implementación observada y estado |
|---|---|---|
| `POST /api/conexiones` | Correo verificado, `id_receptor`; solicitante desde JWT, 422 a sí mismo y 409 por par pendiente/aceptado. | **Parcial.** `POST /conexiones/` usa `id_receptor_FK`, admite `id_solicitante_FK` opcional y comprueba identidad y receptor. |
| `GET /api/conexiones`, `GET /api/conexiones/aceptadas` | Sesión; dirección y estado, fechas y resumen del otro usuario. | **Parcial.** `GET /conexiones/recibidas`, `/conexiones/enviadas` y `/conexiones/aceptadas`; consultas de filas limitadas a 100, sin el resumen canónico. |
| `GET /api/conexiones/con/{id_usuario}` | Sesión; estado y dirección de la relación con ese usuario. | **Pendiente.** La consulta de perfil público no resuelve esa relación. |
| `PATCH /api/conexiones/{id}` | Receptor, desde Pendiente, acepta o rechaza. | **Parcial.** `PUT /conexiones/{id}` recibe `estado` y valida al receptor. |
| `DELETE /api/conexiones/{id}` | Cualquiera de las partes, 204; estado Eliminada conservado en historial. | **Incompatible.** `DELETE /conexiones/{id}` devuelve 204 pero el repositorio ejecuta borrado físico. Afecta la evidencia de relación previa para reportes. |

Fuentes: [router](../../backend/services/match-conexion-service/app/api/routes.py), [servicio](../../backend/services/match-conexion-service/app/application/service.py) y [repositorio](../../backend/services/match-conexion-service/app/infrastructure/repository.py).

### 2.4 Convivencia/Mensajería · pp. 18–21

**Pendiente de implementación en esta rama.** El Gateway revisado carece de estos prefijos y Compose no define este proceso. El contrato separa al dueño del aviso de los integrantes residentes; administración no otorga acceso a chats ni tareas.

| Operaciones públicas contractuales | Permiso, DTO y errores relevantes |
|---|---|
| `GET /api/arriendos/mio`, `GET /api/arriendos/{id}`, `GET /api/arriendos/{id}/integrantes` | Propio activo o 404; detalle e integrantes para residente activo o dueño. Tercero: 403. Arriendo informa IDs, estado, responsable opcional, capacidad, activos y fechas. Integrantes con cursor y filtro de activos. El primer ingreso origina el arriendo. |
| `POST /api/arriendos/{id}/expulsiones` | Solo dueño; usuario, motivo de 1–500 y confirmación verdadera. 403 por actor no autorizado, 422 por datos. Retiro idempotente; revoca chat/tareas, desasigna pendientes, libera cupo y cierra el aviso al salir el último integrante. |
| `GET /api/arriendos/{id}/tareas`, `POST /api/arriendos/{id}/tareas`, `PATCH /api/tareas/{id}`, `PATCH /api/tareas/{id}/estado` | Integrante activo lista con cursor y filtros `estado`/`id_asignado` aplicados antes de paginar, crea con título y asignado opcional o reasigna solo `id_asignado`. Solo el asignado activo completa. 403 sin permiso o asignado no activo; 409 al reasignar completada; 422 por otro estado o campos no admitidos. DTO incluye IDs, título, descripción, estado, creador y fecha. Ver [evidencia E04 y dependencia móvil abierta](../evidence/E04/README.md). |
| `GET /api/conversaciones`, `GET /api/conversaciones/{id}`, `GET /api/conversaciones/{id}/mensajes`, `POST /api/conversaciones/{id}/mensajes` | Un chat por arriendo; lectura desde el ingreso efectivo, 403 tras retiro. Historia con `antes,limite`. Envío con correo verificado, contenido de 1–2000 e `id_cliente` UUID. Mismo UUID y contenido devuelve el mismo mensaje; distinto contenido, 409. El UUID solo se devuelve al emisor. Consulta al abrir o actualizar. |

### 2.5 Reputación/Historial/Reportes · pp. 22–23

**Pendiente de implementación en esta rama.** El alcance de este servicio en Sprint 3 es reportes. Las rutas administrativas existentes de resumen y publicaciones tienen otro propósito.

| Operaciones públicas contractuales | Permiso, DTO y errores relevantes |
|---|---|
| `POST /api/reportes`, `GET /api/reportes/mios` | Crear con correo verificado, categoría, descripción de 1–1000 y exactamente un objetivo (422). Usuario: conexión aceptada previa o convivencia solapada. Publicación: no puede reportarla su dueño. 403 sin permiso; 503 sin crear si falla la consulta interna. Mis reportes con sesión y cursor, sin nota administrativa. |
| `GET /api/admin/reportes`, `GET /api/admin/reportes/{id}`, `PATCH /api/admin/reportes/{id}` | Solo panel web y rol admin. Lista por estado/tipo y cursor; detalle con bitácora. PATCH con estado y nota interna opcional. Pendiente pasa a En_Revision o Descartado; En_Revision pasa a Resuelto o Descartado. Otra transición: 409. Notificar al denunciante; resolver no retira integrantes ni elimina contenido. |

### 2.6 API interna entre servicios · pp. 11, 15, 17, 21 y 24–26

Next.js y Expo no llaman estas rutas. El contrato exige comunicaciones directas, JWT de servicio con emisor de origen, audiencia de destino y vida máxima de 60 s. Las mutaciones requieren clave de idempotencia; misma clave con otro cuerpo produce 409. El Gateway inspeccionado usa una lista de rutas públicas permitidas. Los endpoints locales `/internal/v1/*` tienen DTO y autenticación propios.

| Servicio y consumidor | Método y ruta contractuales | DTO o efecto | Comparación en `013e105` |
|---|---|---|---|
| Auth/Users ← servicios | `GET /internal/identidad?supabase_id=…` | ID entero, correo verificado, rol y activo. 404 sin perfil inicializado; caché ≤60 s. | **Parcial.** `GET /internal/v1/identidad` usa la identidad del token y devuelve `subject,user_id,email_confirmed,administrator`. |
| Auth/Users ← servicios | `GET /internal/usuarios?ids=…` | Hasta 100 resúmenes públicos con nombre y foto. | **Parcial.** `GET /local/v1/usuarios/publicos` admite lotes de hasta 100; difieren ruta, proyección y control de acceso. |
| Auth/Users ← productores de eventos | `POST /internal/notificaciones` | Usuario, tipo, referencia y `event_key` única; tres tipos de aviso. | **Parcial.** `POST /internal/v1/notificaciones` verifica cabecera de servicio compartida y recibe estado y clave específicos de postulación. |
| Listado ← Convivencia y Reportes | `GET /internal/publicaciones/{id}` | ID, tipo, estado, propietario y capacidad para comprobar permisos. | **Pendiente.** El detalle público y el resumen administrativo no sustituyen esta consulta. |
| Listado ← Convivencia | `POST /internal/publicaciones/{id}/activar`, `POST /internal/publicaciones/{id}/cerrar-por-finalizacion` | Activación idempotente (409 si cerrada); cierre al finalizar sin reabrir. | **Pendientes.** |
| Listado ← Convivencia | `POST /internal/postulaciones/cancelar-por-incorporacion`, `PUT /internal/publicaciones/{id}/ocupacion` | Usuario, arriendo y clave de evento; cancelar otras abiertas. Aplicar activos y versión solo si avanza. | **Pendientes.** |
| Match ← Reportes | `GET /internal/conexiones/relacion?a=…&b=…` | `existio` si alguna vez hubo conexión aceptada en cualquier dirección. | **Pendiente.** Una lista de conexiones actuales no prueba relación histórica. |
| Convivencia ← Listado | `POST /internal/incorporaciones` | Usuario, publicación, postulación y clave; devuelve IDs de arriendo e integrante. 409 por conflicto. | **Pendiente.** Listado ya puede responder Aceptada antes de completar esa incorporación. |
| Convivencia ← servicios | `GET /internal/usuarios/{id}/pertenencia` | `activa` e ID de arriendo opcional. | **Pendiente.** |
| Convivencia ← Listado | `PUT /internal/publicaciones/{id}/capacidad` | Capacidad total bajo bloqueo; 409 bajo ocupación activa, 404 sin arriendo. | **Pendiente.** |
| Convivencia ← Reportes | `GET /internal/convivencia/relacion?a=…&b=…` | `coincidio` si hubo membresías solapadas. | **Pendiente.** |
| Reportes como consumidor | Sin endpoint interno propio definido en el capítulo 7 | Consulta dueño, conexión o convivencia y envía aviso al resolver. | **Pendiente** el flujo. No se ha verificado tráfico entre procesos. |

### 2.7 Eventos, consistencia e imágenes

El contrato exige outbox transaccional, entrega con reintentos y deduplicación por `event_key`. Convivencia produce `integrante_incorporado`, `integrante_salio`, `ocupacion_cambiada` y `arriendo_finalizado`; Listado produce `publicacion_cerrada` y `postulacion_resultado`; Reportes produce `reporte_actualizado`. Listado ya registra eventos de postulación y tiene un cliente de notificaciones. **Parcial:** esa ruta no cubre los siete eventos ni acredita entrega tras una caída. [Repositorio de Listado](../../backend/services/listado-applications-service/app/infrastructure/repository.py)

En la aceptación, Listado debe registrar la operación y reintentar con la misma clave. Convivencia bloquea capacidad, valida pertenencia única/no reingreso y confirma el integrante en su transacción. Solo después Listado confirma Aceptada. El feed lee una copia versionada; un evento antiguo no puede aumentar cupos. El retiro del último integrante debe finalizar el arriendo y cerrar la publicación. **Pendientes** la coordinación y la conciliación. Para ambos clientes, `incorporacion_pendiente` no acredita acceso a chat, tareas ni Mi arriendo.

El capítulo 9 exige buckets `perfiles` y `publicaciones`, lectura pública y escritura exclusiva del backend. Validar tipo real, decodificación, píxeles y máximo de 5 000 000 bytes por archivo. Subir con clave nueva, confirmar referencias y orden antes de limpiar objetos antiguos, y registrar limpieza pendiente para reintento. **Parcial:** el formulario de Listado admite una imagen y usa almacenamiento local. **No verificado:** persistencia en Storage, recuperación de fallos y lectura cruzada web/Expo.

### 2.8 Consumo actual y transición de clientes

### Correspondencia de rutas para adaptar clientes

| Servicio | Método y ruta actuales | Método y ruta de destino | Estructura actual | Estructura objetivo | Errores o permisos | Consumidor | Estado y evidencia |
|---|---|---|---|---|---|---|---|
| Auth/Users | `GET /usuarios/me`, `GET /local/v1/perfil` | `GET /api/usuarios/me` | `ProfileResponse` o perfil local con edad calculada. | Usuario propio con fecha de nacimiento, edad, intereses geográficos y verificación. | Sesión. El router provisional devuelve 404 por perfil ausente y 503 si falla el repositorio. | Next.js y Expo | Parcial, routers de perfil y usuarios de §2.1. |
| Auth/Users | `PATCH /usuarios/me`, `PATCH /local/v1/perfil` | `PATCH /api/usuarios/me` | El primero admite edad; el segundo admite presupuesto y zona textual. | Campos editables presentes e IDs geográficos. | Objetivo 422 al intentar cambiar nombre, nacimiento o correo. El alias local exige correo confirmado. | Next.js y Expo | Parcial, modelos de §2.1. |
| Listado | `GET /api/publicaciones`, `GET /api/publicaciones/buscar` | `GET /api/publicaciones` | Arreglo, `cupos_min` y desplazamiento. | Página con cursor y filtro exacto por disponibilidad. | Público. 422 contractual por cursor inválido o filtros de cupos incompatibles. | Next.js y Expo | Parcial, router de §2.2. |
| Listado | `GET /api/mis-publicaciones` | `GET /api/publicaciones/mias` | Arreglo del actor. | Página de publicaciones propias. | Requiere identidad; permisos antes de paginar. | Next.js y Expo | Parcial, función `mine` del router de §2.2. |
| Match | `DELETE /conexiones/{id}` | `DELETE /api/conexiones/{id}` | 204, elimina la fila. | 204, conserva el estado Eliminada. | Solo las partes pueden eliminar la conexión. | Next.js y Expo | Incompatible, repositorio de §2.3. |
| Convivencia | Sin router identificado | `GET /api/conversaciones/{id}/mensajes` | Sin DTO local | Historial hacia atrás desde el ingreso, con `antes` y `limite`. | 403 al perder la membresía. | Next.js y Expo | Pendiente, §2.4. |
| Reportes | Sin router identificado | `GET /api/admin/reportes` | Sin DTO local | Página filtrada por estado y tipo. | 401 sin identidad válida; 403 sin rol administrativo. | Next.js, panel administrativo | Pendiente, §2.5. |

| Cliente y evidencia | Qué puede integrar hoy según código | Qué debe esperar o adaptar |
|---|---|---|
| Next.js en `013e105`: BFF de auth, `src/lib/publicaciones/server.ts` y `applications.ts` | Supabase vía servidor web, perfil local, publicaciones propias y postulantes mediante las rutas actuales. Registro duplicado/PKCE comprobado con transporte simulado. | Adaptar IDs, DTO, filtros y páginas al migrar los routers; verificar acceso por Gateway y correo real. El panel administrativo de reportes queda pendiente aunque exista el panel anterior. |
| Expo, objetos Git locales de `origin/dev-movil@e0e83ed`: `src/services/provisionPerfilService.ts`, `publicacionesService.ts`, `postulacionesService.ts` | El código móvil referencia consulta de perfil, alta local, POST de publicación multipart, postular y Mis postulaciones. El adaptador aún contempla Compartida. | Conservar las rutas compatibles hasta coordinar la versión, retirar Compartida del flujo de este release y probar cursor, región/comuna, imágenes y DTO en dispositivo. Puede crear/consultar reportes cuando exista API; la revisión administrativa corresponde a web. |

La evidencia móvil es una lectura del árbol Git, sin cambiar de rama. El cliente efectivamente entregado por TI4, su configuración de Gateway y su funcionamiento contra el destino siguen **no verificados**.

## 3. Decisiones que deben versionarse

| Decisión | Exigencia exacta del backlog | Impacto en contrato / consumidores | Estado en SCRUM-99 |
|---|---|---|---|
| **D06** | `limite` por defecto 20, rango 1–100; `cursor` opaco; respuesta `items`, `siguiente_cursor`; permisos antes de paginar y cursor ligado a actor y filtros. Feed por fecha descendente e ID de desempate descendente. Cursor inválido: 422. Fin de lista: `siguiente_cursor=null`. | Cambiar listados crecientes y adaptar web/Expo; cursar el cambio en OpenAPI. | Documentado, **sin garantía de implementación**. |
| **D08** | PostgreSQL de negocio en Kubero; Supabase Auth se conserva; decidir host de los procesos con pruebas de red/permisos. | DSN/roles por dominio, separación Auth/negocio, despliegue y persistencia. | Depende de B02/B03. |
| **D09** | Preservar datos e identidades reales al migrar a PostgreSQL Kubero. Una base de demostración vacía no cumple el criterio. | Registrar continuidad de identidades y datos por dominio. | Ejecución y evidencia operativa a cargo de S3R-B03. |
| **D10** | Filtro objetivo `cupos_disponibles=n` por igualdad sobre cupos reales disponibles (backlog pp. 20 y 27; contrato pp. 4 y 7). Durante la transición, combinarlo con `cupos_min` debe devolver HTTP 422. | Coordinar el parámetro, OpenAPI y ambos clientes. | Hoy se implementa el filtro `cupos_min`; el campo de salida `cupos_disponibles` puede ser `null`. La igualdad por disponibilidad real sigue pendiente. |
| **D11** | Selectores de web/Expo ofrecen comunas de **La Araucanía**; catálogo nacional y publicaciones existentes continúan admitidos por API; validar comuna/región. | UI, catálogos y validaciones de Listado. | Pendiente de verificar en ambos clientes. |
| **D12** | Precio CLP entero en `[0, 999999999999]`, sin fracciones; BD `bigint` o `numeric(12,0)` y validación previa; no redondear datos existentes. | Contrato del 18/11, pp. 3 y 7: 422 por fracciones o fuera de rango. El dominio actual acepta hasta dos decimales y el router serializa a `float`. | Parcial; inventario de datos y migración pendientes. |

## 4. Mapa mínimo de dominio / MER

| Dominio | Propietario | Regla |
|---|---|---|
| Usuario/Notificación | Auth/Users | Identidad externa Supabase; Notificación pertenece a Auth/Users. |
| Región/Comuna y Publicación | Listado/Applications | Región y Comuna pertenecen a Listado. Usuario→Comuna es referencia lógica; Publicación→Comuna interna. |
| Conexión y relación previa | Match/Conexión | Consultas por API; no leer SQL ajeno. |
| Pertenencia activa/Chat/Tareas | Convivencia/Mensajería | Fuente de miembros activos; no confiar solo en copia de cupos de Listado. |
| Reporte/Reporte_Historial | Reputación/Historial/Reportes | El alcance contractual de este release se limita a reportes. |

Alias a resolver por versión de MER/DTO: `id_usuario_reportado`/`id_usuario_objetivo`, `id_responsable`/`id_asignado`, `acepta_mascotas`/`mascota`. **No inventar equivalencias adicionales** sin cotejar el MER.

## 5. Aprobación y entrega a TI4

| Campo | Registro |
|---|---|
| Referencia vigente recibida | Contrato del 18/11 distribuido por el Scrum Master. |
| Aprobación formal documentada | **Sin evidencia de firma o aprobación formal.** |
| Documento/fuente del 08/11 contrastado | **PENDIENTE**. |
| OpenAPI actual por servicio y SHA | **PENDIENTE**. |
| Responsable que aprueba API | **PENDIENTE**. |
| Responsable TI4 receptor | **PENDIENTE**. |
| Fecha efectiva de envío/recepción | **PENDIENTE**. |
| Acuerdo de compatibilidad Next.js/Expo | **PENDIENTE**. |
| Evidencia en Jira/PR | **PENDIENTE**. |

**Estado de aceptación:** el equipo distribuyó la referencia vigente y la matriz contrasta sus cinco dominios con el código. Faltan constancia de recepción por TI4, acuerdo de compatibilidad y evidencia operativa.
