# SCRUM-71 — Aislamiento de datos y punto de entrada de la API

## Resultado de la auditoría

La aplicación FastAPI de `backend/main/main.py` es el punto de entrada HTTP único del backend. Registra los routers de autenticación y conexiones y declara las rutas de publicaciones, perfil y ubicaciones. CORS, los errores de validación y `Cache-Control: no-store` se aplican desde esa aplicación. No hay evidencia en el código de que otro gateway o microservicio sea necesario; agregar uno duplicaría el enrutamiento sin cubrir una brecha identificada.

La identidad privada se obtiene de un Bearer JWT validado por `get_identity`: comprueba firma HS256, emisor, audiencia, expiración, claims requeridos, usuario verificado y sesión vigente no revocada en PostgreSQL. `get_current_user` expone únicamente el ID resultante de esa validación. Con autenticación deshabilitada o configuración inválida, las rutas privadas fallan cerradas (503); tokens ausentes, inválidos o sesiones no vigentes devuelven 401.

## Matriz de acceso observada

| Rutas | Acceso y control |
| --- | --- |
| `GET /api/publicaciones` | Público; catálogo de descubrimiento. La consulta devuelve campos explícitos y no incluye propietario ni datos de cuenta. |
| `GET /conexiones/usuarios/buscar`, `GET /conexiones/publicaciones/buscar` | Públicas según el uso de búsqueda existente. `response_model` limita la salida a los campos de búsqueda declarados. |
| `GET /api/ubicaciones` | Público; consulta un proveedor externo y no accede a datos privados de Roomies. |
| `GET /api/mis-publicaciones` | JWT requerido; SQL filtra por el usuario autenticado. |
| `GET /api/publicaciones/{id_pub}` | JWT requerido; consulta por ID y propietario autenticado; ID ajeno o inexistente devuelve 404. |
| `POST /api/publicaciones` | JWT requerido; `id_usuario` de inserción procede del token, no del formulario. |
| `PUT`, `DELETE /api/publicaciones/{id_pub}` | JWT requerido; actualización/eliminación filtran por propietario. La eliminación verifica propiedad antes de borrar imágenes y usa transacción SQL. |
| `GET`, `PUT /api/perfil` | JWT requerido; el perfil y su edición usan el ID autenticado, sin aceptar identidad del cliente. |
| `POST /conexiones/` | JWT requerido; solicitante del cuerpo debe coincidir con la identidad autenticada (403 si no). |
| `PUT /conexiones/{id_conexion}` | JWT requerido; únicamente el destinatario autenticado puede responder; el registro se bloquea durante la actualización. |
| `GET /conexiones/recibidas/{id_usuario}` | JWT requerido; ID solicitado debe coincidir con el usuario autenticado (403 si no). Solo devuelve solicitudes recibidas pendientes. |
| `/auth/*` | Router de autenticación; sus handlers gestionan registro, verificación y login. Logout requiere identidad de sesión. |

Las páginas HTML y los archivos estáticos se sirven públicamente; la protección de datos se aplica en los endpoints API. Las solicitudes privadas reciben `no-store` mediante middleware central. Las búsquedas son públicas por compatibilidad con el flujo de descubrimiento; no se infiere que el perfil completo sea público.

## Hallazgos y decisiones

- En la auditoría de rutas no se encontró acceso API privado sin autenticación ni consulta de publicaciones propias sin filtro de propietario.
- Las consultas SQL de `main.py` son parametrizadas. Las búsquedas ORM usan filtros parametrizados; los esquemas Pydantic de respuesta limitan los atributos serializados.
- Los endpoints de propiedad de publicaciones combinan ID y propietario en las consultas de lectura y actualización. En conexiones, la autorización del destinatario se comprueba en servidor tras seleccionar la fila con bloqueo.
- Las búsquedas de usuarios/publicaciones y el catálogo se conservan públicos como ya requiere el comportamiento de descubrimiento. No se amplía la visibilidad del perfil privado.
- El nombre `API Gateway` en SCRUM-71 se satisface aquí como entrada central de FastAPI; no se añadió una capa paralela.
- El archivo de requisitos original termina truncado durante la sección JWT, así que no contiene instrucciones posteriores que pudieran estar en el adjunto.

## Verificación

`backend/tests/test_auth.py` ya cubre rechazo de identidad suministrada por cookie, permisos cruzados en publicación y conexiones, respuestas públicas de búsqueda, contratos de perfil/publicaciones, revocación JWT y `no-store`. La suite usa dobles en memoria y su runner (`backend/tests/run_isolated.py`) bloquea red, PostgreSQL, SQLAlchemy Engine y SMTP reales.

El intento de ejecutar el runner indicado en la documentación no pudo iniciar el intérprete: `.venv/Scripts/python.exe` reportó que no encontraba la instalación real de Python 3.13, y `py -3.13` confirmó que no hay runtime instalado. No se ejecutó `pytest` directamente porque el runner documenta que no garantiza el mismo aislamiento.

## Límites de la comprobación

La suite aislada no acredita el esquema PostgreSQL desplegado, RLS/grants, carreras reales ni los tipos/nombres de tablas existentes. La documentación de adaptación JWT también registra asuntos de despliegue pendientes (esquema y permisos, secretos y coordinación de clientes). No se tocaron esas configuraciones ni se asumió acceso al entorno de producción. El endurecimiento del upload de foto de perfil también está señalado como trabajo aparte en `backend/auth_service/ADAPTATION.md`; la ruta está autenticada, pero su validación de archivo no se modificó porque no es una brecha de aislamiento de datos.
