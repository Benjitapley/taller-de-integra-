# SCRUM-114 · Panel administrador de reportes

Implementación de S3R-D04 del backlog oficial de Sprint 3 v1.4 (página 25), sobre las implementaciones de SCRUM-96 y SCRUM-113 presentes en `dev-web`. El ticket Jira figura En curso durante la preparación de esta entrega; este documento no acredita aceptación ni despliegue.

## Comportamiento

- `/admin/reportes`: bandeja de 20 elementos, filtros por estado y tipo, páginas anterior/siguiente, actualización y reintento del cursor que falló. Una caída al cambiar de página conserva los resultados anteriores; cambiar filtros inicia una consulta nueva.
- `/admin/reportes/{id}`: antecedentes, denunciante, estado y bitácora. Desde Pendiente admite En revisión o Descartado; desde En revisión admite Resuelto o Descartado. Los estados finales no admiten nuevas decisiones.
- La nota interna es opcional, de hasta 1.000 caracteres. Un conflicto o un resultado incierto conserva el borrador y bloquea el reenvío hasta consultar el estado actualizado. No hay cambios optimistas ni reintentos automáticos de PATCH. El bloqueo síncrono evita envíos simultáneos por doble clic.
- La confirmación exige una respuesta coherente con el reporte solicitado, el estado enviado y la actuación registrada. Después de una respuesta perdida se consulta la bitácora, sin atribuir automáticamente el cambio al intento propio.
- Un 401 invita a iniciar sesión; un 403 muestra acceso insuficiente. La página consulta Reportes desde el servidor antes de incluir sus datos privados en el HTML. El BFF vuelve a validar cada operación y exige origen y protección CSRF para PATCH.
- Resolver o descartar solo registra una decisión sobre el reporte. No elimina publicaciones, expulsa integrantes ni otorga acceso general a arriendos, chat o tareas.

## Política administrativa

En el runtime Supabase/local, Auth/Users verifica el JWT, la sesión revocada y la identidad del resultado de `/auth/v1/user`. El permiso exige correo confirmado y exactamente `app_metadata.rol = "admin"` en ese resultado vigente. No acepta `user_metadata`, una lista `ROOMIES_ADMIN_SUBJECTS`, ni un rol antiguo del JWT como sustituto. La política se comparte con la identidad interna que usa Reportes y con el resumen administrativo; las cuentas que dependían únicamente de la lista dejan de tener acceso administrativo.

El BFF entrega únicamente los campos administrativos del contrato. `Mis reportes` conserva su proyección pública: no entrega notas, bitácora ni identificadores administrativos. Las respuestas de error tampoco trasladan el cuerpo privado del servicio.

## Validación local

Realizada el 23 de noviembre de 2026:

| Comprobación | Resultado |
| --- | --- |
| Auth/Users completo, incluidas política de rol y regresiones de perfil | 155 aprobadas, 2 omitidas |
| Gateway aislado | 146 aprobadas |
| Reportes con PostgreSQL efímero real | 8 aprobadas |
| Web: `node --test tests/*.test.mjs` | 143 aprobadas; 2 recorridos de navegador omitidos en ese comando |
| TypeScript, lint y `npm run build:isolated` | Aprobados |
| Navegador de SCRUM-114, ejecutado aparte con Next/BFF reales y transporte HTTP ficticio | 1 recorrido aprobado, sin omisiones |
| `tests/integration/run_c03.py --web --reports` | Aprobado: Next/BFF/Gateway/Auth/Listado/Convivencia/Reportes reales, PostgreSQL temporal; identidad y Storage ficticios explícitos |

La integración recorre 43 reportes con cursores, filtros, detalle y bitácora; disputa dos decisiones concurrentes (200/409); comprueba la actualización visible para el reportante sin notas; deniega API y URL directa al usuario común y al administrador degradado; y rechaza una sesión expirada. También conserva los recorridos locales de SCRUM-111/112 incluidos en el mismo ejecutor.

El recorrido de interfaz independiente se ejecuta con `npm run test:admin-reports-browser`, definiendo `REPORTS_PLAYWRIGHT_PATH` y `REPORTS_BROWSER_PATH` con las instalaciones locales. Usa Next/BFF/React y navegador reales con transporte HTTP ficticio en loopback, sin usuarios ni datos compartidos. Comprueba navegación entre tres páginas, reintento tras caída, filtro vacío, conservación de nota ante 409 y respuesta perdida, ausencia de confirmación falsa, denegación de URL y limpieza del contenido visible al perder el permiso.

Para las pruebas Python se utiliza el entorno `.venv` de la raíz. La suite completa de Auth requiere tanto el directorio del servicio como la raíz `taller-de-integra-dos/roomies-web` en `sys.path`; su ejecutor aislado antiguo no incorpora el módulo compartido `backend.service_runtime`. La integración C03 y el ejecutor aislado de Reportes crean y eliminan sus propios clústeres temporales. Los cortes de transporte inyectados en C03 pueden producir avisos de conexión abortada en el doble HTTP, sin invalidar las aserciones del recorrido.

## Activación y límites

La web requiere `WEB_REPORTES_ENABLED=true`, el Gateway y Reportes correctamente configurados, sus claves internas y el esquema de Reportes con las migraciones 001, 002 y 003 existentes. Esta tarea no añade migraciones ni crea roles PostgreSQL en Supabase. Tampoco modifica cuentas reales para convertirlas en administradoras.

En el entorno compartido sigue pendiente la activación autorizada de Reportes y la asignación administrativa del lado servidor. La evidencia local con identidad ficticia no demuestra un recorrido con cuentas reales de Supabase ni el entorno publicado. Esas comprobaciones se realizan al activar e integrar el entorno correspondiente; no se fusiona a main ni se despliega como parte de esta entrega.
