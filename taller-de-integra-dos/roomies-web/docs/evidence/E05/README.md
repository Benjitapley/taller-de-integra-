# E05 · Retiro por arrendador

Implementación según backlog Sprint 3 v1.4, páginas 29–30, y contrato Sprint 3 v2, secciones 6.2 y 8.4.

## Comportamiento

- El dueño entra por Mis publicaciones → postulantes aceptados → Gestionar integrantes, o por el enlace de integrantes de un arriendo conocido. Solo el permiso `puede_retirar` confirmado por el servidor muestra la acción. Un admin no obtiene permiso por su rol.
- El diálogo solicita motivo de 1–500 caracteres y confirmación explícita. Un bloqueo inmediato impide envíos concurrentes desde la UI. Un fallo conserva el formulario para reintentar.
- `POST /api/arriendos/{id}/expulsiones` valida dueño contra Listado. Bloquea publicación, arriendo y pertenencia; termina la pertenencia, desasigna tareas pendientes, deja intactas las completadas y registra actor, motivo y fecha en una transacción. El retiro repetido de la misma persona es inocuo, incluso con solicitudes concurrentes.
- El responsable retirado deja vacante el rol. No hay relevo automático. El último integrante finaliza el arriendo e impide nuevas incorporaciones; una persona retirada no puede reingresar al mismo arriendo.
- La misma transacción registra una proyección versionada y un aviso en `retiro_outbox`. El recuperador existente reintenta entregarlos. Listado aplica la ocupación sin retroceder versiones; al finalizar cierra el aviso, cancela postulaciones pendientes y genera sus avisos. Una confirmación de incorporación antigua no reabre el aviso.
- Chat y tareas comprueban pertenencia activa en cada operación, incluso por ID directo. En web se descartan las pantallas privadas tras 401/403/404 y se vuelve a verificar al regresar a la ventana. Mi arriendo consulta nuevamente y elimina los accesos activos. En móvil se comprueba la API al entrar/regresar a la app; una denegación desmonta la pantalla y vacía el almacén de demostración.
- Se añadió persistencia y API mínima de tareas (crear, listar por cursor/filtros, reasignar pendientes, completar solo por asignado activo) porque el estado anterior era una vista local. La ruta web de tareas ahora consume esa API y permite reasignar las tareas que quedan sin asignado.

## Diseño

El diálogo reutiliza el componente Modal, botones, tipografía, morado y superficies redondeadas existentes. Los 33 mockups entregados no incluyen una pantalla específica de expulsión. Las capturas [escritorio](./retiro-confirmacion.png) y [ancho móvil web](./retiro-confirmacion-mobile.png) muestran el nuevo diálogo con datos sintéticos. No son una prueba de Expo en celular físico.

## Activación

1. Aplicar [005_retiros.up.sql](../../../backend/services/convivencia-mensajeria-service/migrations/005_retiros.up.sql) como migrador después de 001–004. Conserva las pertenencias existentes y toma al primer integrante histórico como responsable; si ya está inactivo deja el rol vacante. No ejecutar el rollback de 001 sobre datos reales.
2. Desplegar Convivencia, Listado, Gateway y Next de esta revisión. Las nuevas rutas públicas son `/api/arriendos/{id}/integrantes`, `/expulsiones`, `/tareas`, `/api/tareas/{id}` y `/estado`; sus adaptadores Next usan `/web-api`.
3. Convivencia y Listado reutilizan `ROOMIES_INTERNAL_TOKEN` para las consultas y proyecciones internas, siguiendo el mecanismo de reservas existente. Configurar `LISTADO_UPSTREAM_URL`, `AUTH_USERS_UPSTREAM_URL` y `CONVIVENCIA_AUTH_JWT_KEY` en Convivencia; Auth debe compartir esa clave para verificar los avisos. La clave nunca va a los clientes. El gateway sigue retirando credenciales internas entrantes.
4. La respuesta de retiro contiene ocupación, estado e indicador `sincronizacion_pendiente`. La revocación local ya está confirmada aunque Listado o Auth estén caídos; la UI distingue la sincronización pendiente. Las tareas Completada conservan su asignación.

OpenAPI del servicio publica los modelos de solicitud y respuesta del retiro y de tareas. El detalle de arriendo conserva `ocupacion` y `version_capacidad` y agrega `estado`, `id_responsable` y `puede_retirar`. Mi arriendo agrega `id_usuario_actual`; el BFF normaliza la ocupación al formato de las vistas web.

## Validación reproducible

Desde cada servicio:

```powershell
# Convivencia: PostgreSQL efímero, rol dedicado, puertos externos simulados
python tests/run_isolated.py
# Listado: pruebas relacionadas con retiro, reservas y ocupación
python tests/run_isolated.py -k 'retiro or owner_interno or reserva or ocupacion'
```

Desde frontend-next:

```powershell
npm.cmd run test:convivencia
npm.cmd run test:convivencia-browser
npm.cmd run typecheck
npm.cmd run lint
```

La prueba de navegador usa Edge instalado en Windows (o `E05_BROWSER_PATH`), Next/BFF reales y un Gateway HTTP sintético en loopback. Crea una copia temporal sin `.env`, sin cuentas reales, y elimina sus procesos y directorios al terminar. `E05_QA_DIR` permite regenerar las capturas. Comprueba confirmación obligatoria, respuesta perdida tras guardar, reintento, doble clic, acción ausente para quien no es dueño y descarte de tareas tras denegación.

Resultado SQL: 80 pruebas de Convivencia aprobadas. Listado: 11 pruebas seleccionadas aprobadas; la suite completa encontró dos pruebas de multipart bloqueadas por falta de `python-multipart` en el Python local. Los errores iniciales de las nuevas pruebas de Listado se corrigieron y la selección de retiro pasó. BFF: 22 pruebas aprobadas incluyendo las de aplicaciones y reportes. Gateway: 25 pruebas aprobadas. No se modificaron bases compartidas ni se desplegó en Kubero.

La prueba de navegador pasó en Edge sin errores JavaScript: confirmación, respuesta perdida, doble clic, exclusión del no propietario y limpieza de tareas tras revocar. Se comprobó además que el diálogo no desborda a 390 px. Typecheck web/móvil y lint web/móvil pasaron. Las 12 pruebas locales de convivencia móvil, incluido vaciado del almacén por retiro, pasaron.

La aceptación con cuentas reales, persistencia en el entorno desplegado y celular físico sigue pendiente. El chat y las tareas de Expo conservan su implementación de demostración; el nuevo control de pertenencia evita mostrarlos a una persona retirada, pero no acredita la integración móvil de E03/E04 ni el cierre de E06.
