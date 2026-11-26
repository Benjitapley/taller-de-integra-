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

Comprobación posterior del 26/11 con los datos del usuario: [identidad real y diagnóstico de Kubero](evidence/E03/2026-11-26-hosted/README.md). Ambas cuentas autenticaron en Supabase (200 y correo confirmado). El Gateway de Test devuelve 503 en perfil/arriendo/conversaciones; la web publicada devuelve 503 al iniciar sesión. En Kubero Test faltan aplicaciones de Auth/Users, Listado y Convivencia, y el Gateway solo configura el destino de Match. **El bloqueo actual es el despliegue e integración, no la entrega de credenciales.** No se acredita todavía una pertenencia ni el chat con esas cuentas.

Revisión del 2026-11-26: [ensayo integrado de navegador, HTTP y PostgreSQL](evidence/E03/validacion-2026-11-26.md). El recorrido local ya demuestra envío entre dos integrantes, recarga, paginación visual, reintentos, permisos y retiro, cambios de cuenta y persistencia después de reiniciar Convivencia. La identidad de ese ensayo es una fixture GoTrue/JWKS explícita: **no constituye aceptación con Supabase real ni PostgreSQL Kubero**. Se corrigió la identificación del emisor por nombre; ahora se usa su ID de negocio, también presente en el perfil de transición.

Los resultados siguientes describen revisiones históricas; los fallos antiguos por ausencia de PostgreSQL no representan el estado del runner actual.

Revisión del 2026-11-25: [migraciones, SQL real y pendientes de aceptación web](evidence/E03/validacion-2026-11-25.md). PostgreSQL 19 en 5432 ya tiene `roomies_local` migrada y tres regresiones SQL aprobadas. Falta confirmar la configuración pública de Supabase Auth de staging y ejecutar la aceptación con dos identidades, Gateway y navegador. El registro anterior se conserva como evidencia histórica; el reporte enlazado contiene el estado actual.

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

El [informe del 26/11](evidence/E03/validacion-2026-11-26.md) distingue los casos ya probados localmente del cierre en destino. Para aceptar el paquete conforme al backlog aún se requiere:

- [x] Confirmar el proyecto Supabase facilitado por el usuario y autenticar dos cuentas reales con correo confirmado. Su pertenencia al arriendo sigue sin verificar por los errores 503.
- [ ] Desplegar Auth/Users, Listado y Convivencia con imágenes reales, migraciones y roles de Kubero; configurar sus destinos en el Gateway y en la web. Preparar/verificar integrantes y actores para los casos negativos.
- [ ] Repetir el guion contra Gateway/servicios desplegados y PostgreSQL Kubero, con esas identidades reales. Conservar el resultado de cada caso, sin presentar la fixture de identidad como Supabase.
- [ ] Asociar la evidencia de destino al SHA efectivamente desplegado y a la PR correspondiente. [Jira SCRUM-120](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-120).

Estado: **implementación y ensayo integrado local comprobados; aceptación en destino pendiente**. El ensayo local no cambia Jira a terminado.
