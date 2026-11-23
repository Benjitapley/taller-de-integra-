# SCRUM-115 · Navegación y paginación de listas privadas

Implementa S3R-D05 del backlog oficial Sprint 3 v1.4, revisión 18/11/2026, página 26. Jira contiene el título y figura En curso durante la implementación. Dependencias: SCRUM-112, SCRUM-114 y SCRUM-108. Rama creada desde Jira sobre `dev-web` con base `05278f33be7bbd96e6a7a8311505c713fa239815`; entrega dirigida únicamente a `dev-web`.

## Listas y contrato

| Lista | Paginación y alcance |
| --- | --- |
| Mis publicaciones | `GET /api/publicaciones/mias`, páginas de 20 mediante cursor del servidor |
| Mis postulaciones | `GET /api/postulaciones/mias`, páginas de 20 y filtro de estado |
| Postulantes de una publicación | `GET /api/publicaciones/{id}/postulantes`, páginas de 20 y filtro de estado; identidad y permiso del dueño comprobados en servicios |
| Mis reportes | `GET /api/reportes/mios`, cursor del servidor; proyección propia sin notas administrativas |
| Bandeja administrativa | `GET /api/admin/reportes`, controles anterior/siguiente de la 114; filtros de estado/tipo y tamaño de 20 |

Publicaciones, postulaciones y reportes propios comparten el control **Cargar más**, el reintento y los estados de carga/final. La bandeja administrativa conserva sus controles equivalentes por página. Ninguna lista divide en el navegador un arreglo completo obtenido del servicio.

El controlador compartido bloquea llamadas simultáneas, cancela la consulta anterior al cambiar filtros o desmontar, descarta respuestas canceladas, reinicia cursores al cambiar la consulta, deduplica por ID y detecta cursores que regresan a páginas ya recorridas. Un fallo de la página siguiente conserva los elementos previos y permite reintentar ese cursor. Una página final vacía conserva las filas anteriores y muestra fin de lista; una primera página vacía muestra el mensaje de ausencia correspondiente.

Los BFF de publicaciones propias y postulaciones validan tamaños, cursores e IDs repetidos. Postulaciones exige el DTO paginado `items/siguiente_cursor`; ya no acepta un arreglo completo heredado como sustituto. Se mantienen las rutas y mutaciones de admisión de la 112.

## Sesión y navegación

El contenedor privado se identifica con una huella SHA-256 del token que permanece en servidor. Cambiar de sesión y actualizar la navegación reinicia los componentes privados y sus borradores; el bearer no se serializa como clave de interfaz. La autorización sigue en cada operación del BFF/servicio, independiente de esta huella. Un 401/403/404 en las listas compartidas retira sus filas privadas; los fallos recuperables conservan lo cargado.

Se incorpora **Mis reportes** al menú únicamente cuando reportes está habilitado. Se ocultan Mis conexiones, Favoritos y Ajustes del menú de entrega, y la opción Personas de Inicio. Las implementaciones anteriores no se borran; se conserva la relación interna que permite reportar a personas según el contrato. Chat, Mi arriendo y tareas siguen siendo parte del alcance de sus tareas responsables; esta entrega no sustituye su conexión pendiente.

## Evidencia local, 23/11/2026

- `node --test tests/*.test.mjs`: **145 aprobadas, 3 omitidas**, sin fallos. Los tres recorridos de navegador se ejecutan aparte con las variables de navegador configuradas.
- `npm run typecheck`, `npm run lint`, `npm run build:isolated`: aprobados.
- `APPLICATIONS_BROWSER_TESTS=1 node --test tests/proxy.test.mjs`, con `PROFILE_PLAYWRIGHT_PATH` y `PROFILE_BROWSER_PATH`: 13 aprobadas, sin omisiones; incluye aceptación, respuesta perdida, recuperación, permiso denegado y 41 postulantes paginados en navegador. El transporte sigue siendo ficticio y las fixtures usan el DTO paginado del contrato.
- Navegadores 113/114/115 con `REPORTS_PLAYWRIGHT_PATH` y `REPORTS_BROWSER_PATH`: Next/BFF/React y navegador reales, HTTP ficticio en loopback. Tres recorridos aprobados sin omisiones. La 115 recorre cinco listas de 43 registros, falla la segunda página, reintenta, repite clics sin duplicar la solicitud, cambia filtros, vuelve desde una última página vacía y cambia de cuenta sin conservar filas ni cursores anteriores.
- `.venv/Scripts/python.exe -I -B taller-de-integra-dos/roomies-web/tests/integration/run_c03.py --web --reports` desde la raíz: aprobado. Next/BFF/Gateway/Auth/Listado/Convivencia/Reportes reales y PostgreSQL temporal; proveedor de identidad y Storage ficticios. Mantiene admisión concurrente, recuperación de respuestas perdidas, perfil y revisión de reportes con notas privadas.

Para repetir la prueba específica de la 115 desde `frontend-next`, definir las rutas locales de Playwright y del navegador instalado y ejecutar `npm run test:private-lists-browser`. Las fixtures y servicios temporales se eliminan al terminar; no cargan el dotenv compartido. Los cortes intencionales de C03 pueden registrar conexiones abortadas en el doble HTTP; las aserciones y el código de salida determinan el resultado.

## Límites y siguiente entrega

No se modifica el esquema compartido, no se crean usuarios técnicos, no se asignan roles administrativos reales ni se despliega. La prueba con más de 40 registros para cada una de las cinco listas usa transporte HTTP ficticio; la integración SQL real cubre los recorridos indicados, incluidos 43 reportes, pero no acredita ese volumen SQL en todas las listas.

SCRUM-116 debe verificar el recorrido completo del candidato con cuentas y dependencias reales, persistencia y permisos, una vez disponibles sus dependencias. Pasar estas pruebas locales no significa que chat/tareas/retiro estén conectados ni que el entorno publicado esté validado. La fusión del PR queda a cargo del usuario.

## Descripción para el PR

Unifica la carga por cursor de publicaciones, postulaciones y reportes privados, conserva filas ante errores y reinicia la lista al cambiar filtros o sesión. Añade filtros de estado a postulaciones, distingue vacío inicial de fin de lista, valida páginas en el BFF y oculta navegación fuera del alcance. Conserva la bandeja administrativa de la 114 y los flujos de aceptación de la 112.

Validación: 145 pruebas web; tres recorridos de navegador ejecutados aparte, incluidas las cinco listas con 43 registros y transporte HTTP ficticio; TypeScript, lint y build aislado. Integración HTTP con servicios y PostgreSQL temporal reales aprobada, con identidad y Storage ficticios explícitos. Evidencia y límites en este documento. La aceptación con cuentas reales y el recorrido completo corresponden a SCRUM-116. Base del PR: `dev-web`; sin fusión a main ni despliegue manual.
