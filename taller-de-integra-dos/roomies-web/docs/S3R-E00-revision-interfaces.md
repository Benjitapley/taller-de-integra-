# S3R-E00 · Matriz de revisión de interfaces

Esta matriz registra la revisión E00 de la rama `SCRUM-117`. La revisión inicial quedó en `946f9a8`; tras integrar `dev-web` en `e55440c`, chat e integrantes usan las vistas conectadas de E02/E03. Hay capturas de ambos momentos en el índice de evidencia. Favoritos y Ajustes, fuera del recorrido comprometido, no aparecen en el menú.

**Fuente de tipos:** `frontend-next/src/features/recorrido/types.ts` define la vista de Mi arriendo, integrantes, chat y tareas. Se cotejó con `Contrato_Microservicios_Roomies_Sprint3_v2_editado.pdf` del 18/11/2026, secciones 1.4 y 6.1–6.4 (pp. 3, 18–21). Los tipos de la vista siguen siendo una proyección y no acreditan un DTO acordado con TI4 ni integración con la API.

### Cotejo del contrato Sprint 3 v2

| Recurso | Confirmado en v2 | Pendiente para el DTO compartido |
|---|---|---|
| Mi arriendo | `GET /api/arriendos/mio` devuelve el arriendo activo o 404; el arriendo incluye identificadores, estado, cupos, responsable, origen y fechas. | La vista solo consume los campos que muestra. Acordar con TI4 la forma exacta de `rol`, `es_responsable` y datos del chat incluidos en `/mio`, y cómo mapear `origen`, `fecha_inicio` y `fecha_fin`. |
| Integrantes | `GET /api/arriendos/{id}/integrantes` incluye fecha de ingreso/salida, responsable, filtro `activos=true` y cursor. El dueño puede leer integrantes, pero no chat ni tareas. | `nombre` y `activo` son datos preparados para la vista; acordar su origen o derivación, `fecha_salida` y el sobre paginado `{items, siguiente_cursor}`. |
| Chat | La sección 6.4 confirma `id_mensaje`, `id_conversacion`, `id_emisor`, `contenido`, `fecha` y `id_cliente` solo para el emisor. Mensajes con cursor `antes`/`limite`; retiro implica 403 incluso para el historial. | `nombre_emisor` se resuelve para la vista. Acordar cabecera, nombre visible, último mensaje y presentación de errores con TI4. El envío idempotente y la carga por cursor corresponden a E03. |
| Tareas | La sección 6.3 confirma título 1–120, descripción hasta 1000, asignado opcional, estados Pendiente/Completada, creador y fecha de creación. No existe fecha límite en este release. | Acordar el sobre paginado y la presentación de tareas sin asignar. La conexión y mutaciones corresponden a E04. |

El formato de error v2 usa `codigo` y `mensaje`; el cliente debe elegir el texto visible por `codigo`. Para ausencia de arriendo usa `404 no_encontrado`; para acceso retirado o ajeno usa `403 sin_permiso`; una dependencia caída responde `503 dependencia_no_disponible` y no se transforma en lista vacía. La tabla siguiente propone las etiquetas visibles que TI4 debe confirmar.

## Etiquetas y errores propuestos para revisión conjunta TI2/TI4

| Situación contractual | Etiqueta o mensaje en web | Estado HTTP de referencia | Confirmación TI4 |
|---|---|---:|---|
| Sin arriendo activo | Aún no tienes un arriendo activo. | 404 | Pendiente |
| Carga en curso | Cargando tu arriendo… / Cargando información… | — | Pendiente |
| Error temporal de lectura | No pudimos cargar… Intenta nuevamente. / Reintentar | 503 o error de red | Pendiente |
| Integrante sin acceso después del retiro | Acceso retirado. Ya no perteneces a este arriendo. | 403 | Pendiente |
| Lista vacía | Aún no hay integrantes/tareas/mensajes. | 200 con lista vacía | Pendiente |
| Tarea sin asignar | Sin asignar | — | Pendiente |
| Chat disponible | Chat del arriendo / Conversación compartida por integrantes activos | 200 | Pendiente |
| Responsable de convivencia | Responsable de convivencia; otros integrantes residentes | 200 | Pendiente |

Las etiquetas son una propuesta para comparar con TI4; no se registra aquí un acuerdo que aún no está acreditado. Antes de cerrar E00, el responsable TI4 debe confirmar estas etiquetas/errores o indicar sus ajustes, y se debe registrar fecha y evidencia de esa respuesta.

## Revisión de mockups y alcance

La UI se coteja con `n_w_chat_convivencia_02.png`, `n_w_chat_convivencia_01.png`, `n_m_chat_convivencia_04.png` y `w_tarea.png` de la galería Roomies TI4. El panel activo adopta la cabecera lavanda, las tarjetas de chat y tareas y el resumen lateral del grupo; el chat incorpora cabecera, burbujas y compositor; el formulario de tarea usa el diálogo compacto y las acciones al pie. Se adaptó el lenguaje visual a los datos y acciones disponibles en E00: no se inventan dirección, recordatorios, documentos ni fecha de tarea. La lista de integrantes muestra al **residente responsable** y a los demás residentes; el arrendador dueño y los postulantes se consultan por separado desde Mis publicaciones. El campo `es_responsable` no identifica al arrendador. Las pantallas excluidas (invitaciones, documentos compartidos, calendario/recordatorios y relevo) no se incorporan a la navegación de demo.

## Estados revisables

En el commit inicial de E00, los selectores de `/mi-arriendo`, `/mi-arriendo/integrantes`, `/mi-arriendo/chat` y `/mi-arriendo/tareas` permitían revisar carga, error recuperable, ausencia de arriendo/lista vacía y contenido con fixtures locales. Tras integrar `dev-web`, `/mi-arriendo` conserva su selector de desarrollo; integrantes y chat usan las rutas conectadas y comprueban pertenencia. Tareas usa una vista local tras comprobar pertenencia. La nueva captura sintética demuestra la presentación del 403 y la ocultación de acciones, pero no sustituye una prueba de revocación con el servicio real.

**Compatibilidad pendiente tras el merge:** el servicio de chat integrado actualmente devuelve `id_remitente`, `nombre_remitente` y `fecha_envio`; el contrato v2 exige `id_emisor` y `fecha`. Se mantienen tipos separados para la vista contractual y la respuesta actual del servicio. Hay que coordinar la migración del servicio, BFF y cliente antes de afirmar compatibilidad con v2.

## Evidencia registrada y pendientes

- Dieciocho capturas: nueve de la revisión inicial y nueve de las rutas integradas actuales, en el [índice de evidencia](evidence/E00/README.md). Se generaron con Next local y una API sintética; no incluyen datos reales.
- Los capturadores completaron las comprobaciones DOM de estados, retorno de «Reintentar», foco inicial del modal, etiquetas asociadas, valor «Sin asignar», cierre con Escape y ausencia de «Nueva tarea» en estado retirado. Se corrigió el contraste del texto verde del banner y de los placeholders del formulario (ratios calculados 5,42:1 y 4,87:1), y el placeholder del chat y su contorno de foco (5,64:1). Sigue pendiente una evaluación manual con lector de pantalla y de contraste del recorrido completo.
- La consulta de integrantes se desacopló de `WEB_REPORTES_ENABLED`; ese indicador controla Reportes y no debe ocultar la lista de residentes. La prueba de BFF cubre la consulta con Reportes desactivado y la eliminación de datos privados.
- ESLint de los archivos modificados, `git diff --check` y `tsc --noEmit` con la configuración normal: sin errores. La ejecución de Next.js regeneró los tipos de `.next/dev` que estaban obsoletos.
- Confirmación de TI4 para las filas de esta matriz: pendiente; registrar fecha y persona/evidencia cuando se reciba.
- SHA de la revisión inicial: `946f9a8a9b6159ed8faeb09248ad73a19ad89b0a`; base integrada de la revisión actual: `e55440c7efe885acdf758f3d7407b6498582d786`. Anotar el SHA final y el enlace PR/Jira al publicar esta revisión. El acuerdo TI4 sigue pendiente.
