# S3R-E03 · Chat de convivencia persistido en web

## Implementación

- La vista real de `/mi-arriendo/chat` consulta el arriendo activo y localiza su conversación en `GET /api/conversaciones`.
- El historial se obtiene al abrir y al actualizar. La paginación hacia atrás usa `antes` y `limite`; al anteponer mensajes conserva el desplazamiento de lectura.
- El envío valida 1–2000 caracteres en cliente y BFF. Cada mensaje obtiene un UUID `id_cliente` al crearse; el reintento conserva el mismo UUID y contenido.
- Se muestran estados de envío y fallo. Un fallo nunca se presenta como persistido.
- Las respuestas de carga/envío llevan generación de conversación; al actualizar o recuperar foco, una respuesta tardía de la conversación anterior se descarta.
- Las rutas BFF reenvían el JWT al servicio, limitan los DTO y no guardan mensajes en caché. Las respuestas 401/403 se conservan como errores de acceso; un 403 limpia el historial visible.
- No se agregó WebSocket ni Supabase Realtime.
- La conversación presenta los mensajes en burbujas adaptables, marca integrantes activos y permite reintentar fallos sin cambiar `id_cliente`. La referencia visual de conversación es `n_m_chat_convivencia_04.png`; la referencia web `n_w_chat_convivencia_02.png` muestra el dashboard de arriendo.
- Captura actual con datos sintéticos: [chat-demo-local.png](evidence/E03/chat-demo-local.png). Sus mensajes no demuestran persistencia de backend.

## Estado de aceptación

**Implementación web y backend integrada al contrato; aceptación funcional incompleta.** Se añadieron las rutas de Mensajería al servicio Convivencia y al Gateway, junto con la migración PostgreSQL `004_mensajeria.up.sql`. El servicio verifica la pertenencia activa en cada operación, limita el historial al ingreso y deduplica el envío por remitente/conversación/UUID. No se pudo comprobar persistencia entre dos integrantes ni denegación efectiva con cuentas reales porque este trabajo no se ejecutó contra una base migrada, Gateway y servicio desplegados. No declarar E03 completamente aceptado hasta ejecutar esos casos en ese entorno.

## Evidencia de esta revisión

- Entorno: Windows / PowerShell, Node `v24.20.0`, Next.js `16.4.3`.
- SHA base (cambios de esta tarea sin commit): `62af7100dba77a550c7a08ac7ca8860b021aaeda`.
- `git diff --check`: exit 0; Git informó únicamente conversión LF/CRLF para `ChatPreviewPage.tsx`.
- `node node_modules/next/dist/bin/next typegen`: exit 0.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node node_modules/eslint/bin/eslint.js src/lib/recorrido/chat.ts src/app/web-api/conversaciones src/features/recorrido/ChatPreviewPage.tsx`: exit 0.
- `python -m py_compile` sobre los módulos modificados del Gateway, identidad y Convivencia: exit 0.
- `python -I -B backend/services/convivencia-mensajeria-service/tests/run_offline.py`: 41 passed. Son pruebas HTTP con repositorio simulado; no verifican persistencia PostgreSQL.
- `python -I -B backend/api-gateway/tests/run_isolated.py backend/api-gateway/tests/test_convivencia_routes.py`: 151 passed, incluyendo los casos de rutas de conversación y `403`; Gateway con upstream simulado.
- `python -I -B backend/services/convivencia-mensajeria-service/tests/run_isolated.py`: exit 1, suite PostgreSQL no iniciada porque no hay `pg_ctl`/`initdb` instalados. Docker tampoco está disponible en PATH.
- Reintento de verificación el 2026-11-24: mismo runner sale con `Falta PostgreSQL local. Define POSTGRES_BIN apuntando a su carpeta bin.`; no se encontraron instalaciones en las rutas habituales de PostgreSQL ni comandos `docker`, `docker-compose`, `psql`, `pg_ctl` o `initdb`.
- No se ejecutó la aceptación con dos cuentas, una base migrada y el Gateway/servicio conectados; la persistencia real y el cambio de pertenencia permanecen sin verificar.
- Rama: `SCRUM-120-Implementar-chat-de-convivencia-persistido-en-web`.
- PR/Jira: enlace no disponible en el contexto entregado.

## Pendiente para completar E03

Ejecutar en un entorno integrado con la migración aplicada, PostgreSQL, Gateway y servicio de Convivencia/Mensajería disponibles. La evidencia local con fixtures y las pruebas con repositorios/upstreams simulados no reemplazan estos casos:

- [ ] Con dos cuentas integrantes activas, enviar mensajes desde ambas, actualizar la página y comprobar que los mismos mensajes guardados aparecen en ambos chats.
- [ ] Reintentar un envío ambiguo/fallido y verificar en persistencia que conserva el mismo `id_cliente` y no crea duplicados.
- [ ] Retirar a un integrante y comprobar que no puede consultar ni enviar por la interfaz ni mediante acceso directo a `/api/conversaciones/{id}/mensajes`; registrar respuestas HTTP y confirmar que no hubo lectura/escritura autorizada.
- [ ] Forzar o simular una respuesta tardía al cambiar de conversación/cuenta y comprobar que no mezcla mensajes; verificar que los errores de envío siguen marcados como fallidos.
- [ ] Recorrer historial autorizado con `antes`/`limite` y comprobar que cargar mensajes anteriores conserva la posición de lectura.
- [ ] Adjuntar comandos y resultados sanitizados, SHA del commit probado, entorno, fecha y enlaces a PR/Jira. No hay un enlace PR/Jira registrado todavía.

Hasta completar estos puntos, el estado es **implementado, aceptación E03 pendiente**; no declarar cumplido el criterio de dos integrantes ni el de acceso denegado real.
