# S3R-E00 · Matriz de revisión de interfaces

Esta matriz permite revisar estados de convivencia en las rutas existentes. Los nombres y ejemplos de datos de muestra no implican que la API esté conectada. Los selectores solo aparecen cuando `NODE_ENV=development`; no se agregan rutas al menú de demo.

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

Las etiquetas son una propuesta para comparar con TI4; no se registra aquí un acuerdo que aún no está acreditado. Antes de cerrar E00, el responsable TI4 debe confirmar estas etiquetas/errores o indicar sus ajustes, y se debe registrar fecha y evidencia de esa respuesta.

## Revisión de mockups y alcance

La UI se coteja con `n_w_chat_convivencia_02.png`, `w_tarea.png` y `w_detalle_arriendo.png` de la galería Roomies TI4. La lista de integrantes muestra al arrendador responsable separado de residentes y enlaza a Mis publicaciones para postulantes; las pantallas excluidas (invitaciones, documentos compartidos, calendario/recordatorios y relevo) no se incorporan a la navegación de demo.

## Estados revisables

En desarrollo, los selectores de las rutas `/mi-arriendo`, `/mi-arriendo/integrantes`, `/mi-arriendo/chat` y `/mi-arriendo/tareas` permiten revisar carga, error recuperable, ausencia de arriendo/lista vacía y contenido. Chat, integrantes, tareas y el arriendo activo usan fixtures locales; el formulario de tarea permite dejarla sin asignar. Las rutas de chat, integrantes y tareas permiten además revisar acceso retirado (403). Las vistas de chat/integrantes/tareas muestran que los datos no provienen del backend. No usar esos fixtures en producción ni presentarlos como integración terminada.

## Evidencia registrada y pendientes

- Ocho capturas de ausencia de arriendo, carga, error recuperable, chat activo/error, integrantes, formulario sin asignado y acceso 403: [índice de evidencia](evidence/E00/README.md). Se generaron con Next local y una API sintética; no incluyen datos reales.
- Comando y resultado de captura reproducibles en el índice; el capturador verificó cada estado en el DOM antes de guardar el PNG.
- Typegen, `tsc --noEmit`, ESLint de los archivos modificados y `git diff --check`: completados sin errores.
- Confirmación de TI4 para las filas de esta matriz: pendiente; registrar fecha y persona/evidencia cuando se reciba.
- Asociar el SHA final de la revisión a las capturas al preparar la entrega.
