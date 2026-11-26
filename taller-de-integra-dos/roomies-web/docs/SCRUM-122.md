# S3R-E05 - Retiro por arrendador y revocacion de experiencia activa

Implementacion y aceptacion local verificadas el 26/11/2026 con PostgreSQL 19 y Gateway/Auth-Users/Listado/Convivencia reales. Queda la verificacion del candidato desplegado en E06/B06. Responsable: Gabriel Yamaguchi. [Jira SCRUM-122](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-122). No se modifico el estado remoto de Jira ni se creo un PR.

## Comportamiento

- Mis publicaciones incluye el ID de arriendo confirmado de las postulaciones propias, permitiendo abrir el detalle y sus integrantes sin confundir ID de aviso con ID de arriendo.
- Integrantes recibe `puede_retirar` del servidor. Solo el propietario puede ver la accion. El servidor verifica propiedad por API de Listado; admin no obtiene permiso por rol.
- Se corrigio una incompatibilidad con el detalle canonico de publicaciones: ya no expone `id_propietario`. El detalle de arriendo y sus integrantes verifican al actor autenticado contra `/internal/publicaciones/{id}/propietario`, con credencial interna. Antes, el propietario recibia 403 y no podia abrir la gestion de retiro. La prueba integrada reproduce el contrato real y cubre la regresion.
- `POST /api/arriendos/{id}/expulsiones` recibe `{id_usuario, motivo, confirmo:true}`. Motivo estricto de 1 a 500 caracteres, rechaza blancos y exige confirmacion booleana verdadera. El BFF valida sesion, origen y CSRF; el Gateway permite exclusivamente los metodos contratados.
- Un bloqueo por publicacion y fila de arriendo serializa retiros y admisiones. Una clave unica arriendo/usuario conserva la respuesta del primer retiro; reintentos y doble clic no vuelven a descontar ocupacion ni generan otra notificacion. El formulario tambien bloquea envios simultaneos.
- En la misma transaccion: inactiva pertenencia, registra actor/motivo/fecha, deja tareas Pendiente sin asignado, conserva Completadas, incrementa version y registra proyeccion/notificacion en outbox. El responsable se calcula desde la primera pertenencia; tras retirarlo queda null, sin relevo.
- Mensajes comprueba membresia con bloqueo compartido durante la lectura/envio. Tareas serializa sus operaciones con el retiro sobre el arriendo. No hay consulta historica de chat para retirados.
- El ultimo integrante finaliza el arriendo. La outbox ordena cierre de publicacion y ocupacion cero en una transaccion de Listado. Eventos antiguos no alteran una proyeccion mas reciente; una publicacion Cerrada no se reabre por actualizar ocupacion.
- La outbox se reintenta en el worker existente. Una caida de Listado/Auth no revierte la revocacion local. La UI informa cierre solicitado, sin presentar una entrega remota pendiente como confirmada.
- Chat limpia mensajes, cursor, borrador e identidad al recibir 403/404 e invalida respuestas anteriores. Chat/tareas revalidan membresia cada cinco segundos mientras la pestana esta visible, al recuperar foco y al volver a la pestana. Perder acceso desmonta el contenido y su estado en memoria. Mi arriendo elimina los enlaces activos al actualizar la consulta. Sin Realtime, la deteccion de un cliente inactivo depende de la siguiente consulta; el servidor aplica la revocacion desde el commit.
- Retirar un residente es distinto de retirar voluntariamente una postulacion; no se incorpora salida voluntaria de arriendo ni relevo.

## Dependencias encontradas y cambios necesarios

Durante la implementacion inicial de E05, F03 no estaba implementado y E04 conservaba una vista previa con tareas locales. Se agregaron la transaccion y outbox de retiro, un esquema de tareas y los comandos de crear/asignar/completar con pertenencia activa, BFF y consumo web. La rama actual incorpora ademas la integracion de E04. Las tareas pendientes quedan efectivamente reasignables y se verificaron con SQL y servicios reales. Esto no acredita la aceptacion cruzada con dispositivos ni el despliegue.

## Referencias visuales y contrato

Se revisaron los tres PDF provistos. Prevalece Contrato Microservicios Sprint3 v2 editado, secciones 6.2/6.3 (pagina 19) y 8.4 (pagina 25), y backlog S3R-E05/F03, decisiones D02/D05. No se aplica el permiso administrativo amplio del contrato antiguo.

Se inspecciono `n_w_chat_convivencia_02.png` del paquete Roomies_mockups_TI4_COMPLETO: sidebar, tarjetas blancas, contornos y acentos violeta y radios amplios. La confirmacion usa el modal accesible del proyecto, con foco contenido, cancelacion y campos explicitos. No existe una pantalla de expulsion dedicada en ese paquete; se adapto su lenguaje visual.

## Puesta en marcha

1. Aplicar en el entorno elegido, como migrador, todas las migraciones `*.up.sql` de Convivencia en orden por nombre. Tras integrar `dev-web`, el conjunto incluye las migraciones de compatibilidad hasta [007_expulsiones](../backend/services/convivencia-mensajeria-service/migrations/007_expulsiones.up.sql), ademas de [005_retiro](../backend/services/convivencia-mensajeria-service/migrations/005_retiro.up.sql) y [006_tareas_reasignables](../backend/services/convivencia-mensajeria-service/migrations/006_tareas_reasignables.up.sql). Se verifico sobre una base efimera; no se aplicaron sobre una base del usuario.
2. Desplegar juntos Listado, Convivencia y Gateway; mantener la configuracion de transporte compartido existente. El overlay local sigue requiriendo `ROOMIES_LOCAL_MODE=1`; no habilita por si mismo un despliegue productivo.
3. Configurar el mismo `ROOMIES_INTERNAL_TOKEN` de transporte y una clave exclusiva de avisos `CONVIVENCIA_AUTH_JWT_KEY` en Convivencia y Auth/Users. El [overlay](../docker-compose.convivencia.yml) usa `ROOMIES_CONVIVENCIA_AUTH_JWT_KEY`; no incluir claves reales en evidencia.
4. Ejecutar la suite PostgreSQL desechable y el recorrido contra Gateway real con propietario, integrante y admin ajeno. Verificar retiro concurrente con mensaje/tarea, recuperacion tras caida y cierre persistido. Ambos recorridos locales pasaron el 26/11; el fallo anterior de initdb ya no se reproduce. Comandos y limites en la evidencia.

## Evidencia

Ver [comandos, resultados, entorno y capturas](evidence/E05/README.md). Tras integrar `dev-web` en `99577b4`: Convivencia, 123 pruebas aprobadas sin omisiones; Gateway, 191; BFF y navegador, 17. Typecheck, lint y build aislado: exit 0 con Next 16.4.6. El recorrido `run_c03.py --departures` verifica los cuatro procesos y SQL reales, incluyendo concurrencia, outbox y persistencia tras reinicios. La prueba de navegador cubre Next/BFF/React con HTTP sintetico; las dos capas se prueban por separado. El proveedor externo de identidad es ficticio en las pruebas locales.

La aceptacion local de E05 esta cubierta. Aplicar las migraciones y repetir el recorrido en el candidato desplegado sigue siendo necesario para E06/B06; no se presenta esta evidencia como una prueba de Kubero ni de Expo.
