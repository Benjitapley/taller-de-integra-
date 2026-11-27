# SCRUM-123 · S3R-E06 · Aceptación móvil y paginación

Fecha: 27/11/2026, America/Santiago. Fuente: backlog TI2 Sprint 3 v1.4, p. 30 y D06.

**Estado: correcciones técnicas E06-01, E06-02 y E06-03 resueltas en Kubero TEST y Expo web.** E06-04 conserva pendiente la aceptación con TI4 en teléfono físico y las actas B06. No se atribuye una prueba física al navegador.

## Cambios realizados

- Rama E06 actualizada por avance directo desde `dev-web`, hasta `f00a576478fa144bd6d2cef66877ee895f4a8790`, conservando E05.
- Expo: “Mis postulaciones” solicita `limite=20` y cursor real, valida el sobre `{items,siguiente_cursor}` y ofrece más/reintento/fin. Una petición concurrente no duplica cargas; el fallo conserva filas y cursor; otra sesión descarta respuestas anteriores. El detalle no anuncia ausencia mientras queden páginas.
- Tareas móviles: conserva el cursor fallido al reintentar, evita solicitudes duplicadas, descarta respuestas de otra sesión/filtro y muestra fin de lista.
- Web: integrantes se cargan a demanda, por páginas de 20; se eliminan la descarga completa y el tope artificial de 200. Errores de página conservan selecciones y opciones. Tareas deduplican IDs, reintentan la página fallida y evitan el cambio de filtro durante la inicialización o una mutación.
- SQL de tareas e integrantes usa fecha e ID como clave compuesta. Se comprueban fechas empatadas y fechas que no siguen el orden de asignación de IDs.
- Conversaciones devuelve una página validada con `siguiente_cursor`, límite y cursor firmado ligado a cuenta/lista/límite. La consulta aplica pertenencia activa y límite en SQL. D02 permite un solo arriendo activo: no se fabrican tres conversaciones simultáneas para acreditar volumen.
- Se añadieron fixtures de volumen, un ejecutor de QA, ejemplos HTTP ejecutados y evidencia de integración real. Se aplicaron las tres migraciones existentes de Reportes y la migración de historial de conexiones que faltaban en Kubero.
- Expo: catálogo, detalle, publicaciones propias, creación/edición con imágenes, postulaciones, decisiones, arriendo, chat, tareas, reportes, notificaciones, perfiles y personas usan el Gateway real. Se retiró el proveedor demostrativo de la navegación. Se conserva inicialización explícita del perfil de negocio para cuentas nuevas.
- Permisos de convivencia se comprueban al entrar, reanudar y cada cinco segundos; al perder acceso se desmonta el contenido privado. Tareas permite crear y reasignar, además de completar. Los reintentos de reportes, admisión y publicaciones conservan su clave; chat conserva id_cliente.
- Se creó Reportes como servicio privado, se configuraron sus claves internas y el destino del Gateway. Auth/Listado cuentan con Storage. Match recibió su configuración para haycupo-v1, acceso exclusivo a conexiones y la migración de relaciones históricas. El Gateway admite Idempotency-Key en CORS para Expo web.

## Evidencia y reproducción

El [guion TI2/TI4](qa/S3R-E06-aceptacion.md) contiene casos, versiones y responsables. El [contrato para TI4](contracts/S3R-E06-TI4.md) reúne las rutas y sus diferencias reales; la [colección HTTP](contracts/S3R-E06.http) permite repetirlas con IDs propios del entorno.

Resultados locales y huellas de fuentes: [evidencia E06](evidence/E06/README.md). Los datos de las pruebas SQL son ficticios y viven en bases efímeras. El navegador móvil usa hosts React Native simulados: no constituye prueba de Expo físico.

La [consulta anterior](evidence/E06/hosted-readonly.json) se conserva como diagnóstico del 503. La [consulta posterior](evidence/E06/hosted-after.json) devuelve 200 para Reportes y el contrato paginado de conversaciones. La integración creó el arriendo mediante postulación, preselección y aceptación reales, envió mensajes sin duplicarlos, creó/asignó/completó tareas y envió reportes de publicación y de convivencia. Solo se usaron las cuentas ficticias preparadas para aceptación.

Las [imágenes y etiquetas OCI](evidence/E06/images.json) verifican el código publicado: Gateway `5af51a981b91ecc1df5ca652828b4740a6b504a2`; Auth, Listado, Convivencia, Match y Reportes `eca88225c21a78a91fef150f5dda767bdf61c0bd`. Los [seis pods](evidence/E06/deployed.json) estaban Running y ready, con cero reinicios. Los digests son los resueltos en GHCR; Kubero no expone imageID en esta vista. Solo el Gateway tiene ingreso público.

La [prueba de conexiones](evidence/E06/expo-web-conexiones-live.json) confirmó solicitud/aceptación y navegación al perfil de la otra persona desde ambas cuentas.

La app Expo SDK 57 se exportó y ejecutó en Chromium a 390×844 contra ese Gateway: [recorrido real](evidence/E06/expo-web-live.json), [captura de reportes](evidence/E06/expo-web-reportes.png). El selector web envió una imagen real multipart a Storage. Esto acredita Expo web, no un binario Android/iOS ni un teléfono. Next publicado conserva pendiente su identificación y aceptación externa.

## Resolución y pendiente de aceptación

| ID | Pendiente concreto | Responsable de resolución/confirmación |
|---|---|---|
| E06-01 | **Resuelto:** Reportes privado, migraciones, rol dedicado, claves internas y Gateway. Creación, reintento sin duplicado y seguimiento reales; reporte entre residentes funciona. | Evidencia de despliegue y HTTP enlazada arriba |
| E06-02 | **Resuelto para backend TEST:** seis imágenes publicadas y verificadas, migraciones registradas con SHA-256; Expo web exportado contra el mismo Gateway. Identificar Next publicado y build físico en el acta final. | [Versiones](evidence/E06/images.json) y [pods](evidence/E06/deployed.json) |
| E06-03 | **Resuelto:** las rutas móviles activas del recorrido usan APIs. Catálogos geográficos son arreglos acotados; búsqueda de personas/conexiones conserva el contrato legado de hasta 100 y pide precisar filtros, sin inventar cursor. | [Código móvil](../../../taller%20de%20integra%20cuatro/roomies-app-movil/src/screens/Recorrido.tsx) y [Expo web](evidence/E06/expo-web-live.json) |
| E06-04 | **Pendiente:** aceptación con TI4 en teléfono físico, selector/permisos nativos, cruce Next publicado↔móvil, responsables y actas B06. | Gabriel Yamaguchi + persona TI4 por confirmar en B01 |

La [acta B01](architecture/SCRUM-99-acta-capacidad-S3.md) mantiene pendientes la confirmación nominal TI4 y la ventana. No se inventaron participantes, aceptación ni disponibilidad. Las tres correcciones técnicas solicitadas quedan separadas de la firma y aceptación física de E06-04.
