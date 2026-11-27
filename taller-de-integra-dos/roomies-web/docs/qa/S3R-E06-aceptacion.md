# E06 · Guion y acta TI2/TI4

Fecha de revisión: 27/11/2026, America/Santiago. **Correcciones técnicas desplegadas y verificadas; aceptación física B06 pendiente.** La evidencia distingue laboratorio, HTTP real y Expo web; ninguna sustituye las actas por cliente ni el ensayo en teléfono.

## Identificación y coordinación

| Dato obligatorio | Valor/evidencia |
|---|---|
| Coordinación | Gabriel Yamaguchi, según backlog; sin constancia de reunión física ejecutada |
| Entrega y prueba Expo | Persona TI4 y disponibilidad **sin confirmar** en B01 |
| Entorno/candidato | Cristoper Parra identifica despliegue; candidato E06 aún no aprobado |
| Fuentes de cliente | [Huellas SHA-256](../evidence/E06/sources-sha256.json) del árbol verificado; conservar el SHA del commit del cliente al preparar el build físico |
| Gateway consultado | `https://roomies-gateway-test.inf.uct.cl` |
| Next local / Expo local | Configurados para ese Gateway; no acredita Next publicado ni build físico |
| Versión Expo del proyecto | App 1.0.0, SDK `~57.0.24`, RN `0.86.3`; **build físico y SHA móvil probados pendientes** |
| Dispositivo / SO / Expo Go o build | **Sin registrar: no se ejecutó prueba física** |
| SHA/digests desplegados | Gateway `5af51a9`; Auth/Listado/Convivencia/Match/Reportes `eca8822`. [OCI/digests](../evidence/E06/images.json), [seis pods preparados](../evidence/E06/deployed.json). No se atribuye imageID a la API que no lo expone. |
| BD/migraciones desplegadas | PostgreSQL 17.6, roomies-db-test2. Se aplicaron las tres migraciones existentes de Reportes y la histórica de Match; [registro SQL](../evidence/E06/migrations.json), rol mínimo y RLS comprobados. |
| Contrato | [Entrega E06](../contracts/S3R-E06-TI4.md), OpenAPI del código probado y respuestas de laboratorio/remoto, con diferencias identificadas |
| PR/Jira | SCRUM-123; PR de estos cambios no creada |

No sustituir datos faltantes por la versión del paquete, un viewport de navegador o un SHA posterior a las pruebas. Si cambia código o imagen, repetir lo afectado y el recorrido crítico antes de B06.

## Acta web

Cliente probado: Next/React/BFF real en Chromium local, con API de dominio simulada. Se verifican 44 tareas y 53 integrantes en tres páginas, fallo y reintento de la siguiente página, conservación de formularios, doble clic, filtro, fin, recarga y revocación. La prueba no acredita persistencia del despliegue: esa consulta se comprueba separadamente en SQL y HTTP.

La [consulta anterior](../evidence/E06/hosted-readonly.json) conserva el diagnóstico de Reportes 503. Tras corregir despliegue y migraciones, la [consulta posterior](../evidence/E06/hosted-after.json) y el [recorrido integrado](../evidence/E06/integrated-live.json) verifican negocio y permisos reales. La identificación y aceptación de Next publicado siguen pendientes del acta externa.

## Acta móvil

Cliente automatizado: servicios TypeScript reales y pantalla de tareas ejecutada con React y hosts RN/Router simulados. Se verifican red, tres páginas, reintento, filtro, fin, retiro, cambio de cuenta y respuesta tardía tras desenfoque. **No inicia Expo y no usa teléfono físico**.

Las rutas activas usan el Gateway real. [Expo SDK 57 exportado](../evidence/E06/expo-web-live.json) se ejecutó en Chromium 390×844: catálogo, reportes persistidos, arriendo, envío/relectura de chat, creación de tarea, edición/relectura de perfil y personas. El [recorrido del dueño](../evidence/E06/expo-web-owner-live.json) añadió selector web de imagen, creación/edición, envío de reporte, cierre, retiro y revocación del chat abierto. La lectura final del cierre se repitió con navegación nueva y recarga tras un timeout inicial. **No se ejecutó teléfono físico ni un binario Android/iOS; acta física pendiente**.

## Volumen reproducible sin alterar Kubero

Cada runner crea su PostgreSQL en loopback con roles dedicados y datos ficticios; aplica migraciones y elimina únicamente su clúster temporal. Los puertos de otros servicios y la identidad están inyectados. No cargar cientos de filas en cuentas reales para ejecutar estas pruebas.

| Lista D06 | Fixture y comprobación |
|---|---|
| Catálogo y propias | 53 publicaciones, páginas 20/20/13, fecha empatada y desempate de ID, cursor final nulo |
| Mis postulaciones | 53 filas, fecha empatada, tres páginas, cambio de cuenta/filtro rechaza cursor |
| Postulantes | 125 filas, siete páginas, fechas empatadas, propiedad antes del cursor y filtro/contexto |
| Mensajes | 55 autorizados, tres páginas, fechas empatadas y fuera de orden de ID, excluye preingreso, rechaza retirado |
| Integrantes | 53 activos, páginas 20/20/13, fecha/ID, contexto/límite/cuenta y revocación |
| Tareas | 53 con fechas fuera del orden de ID; tres páginas; además 65 mezcladas por estado, filtro antes del límite |
| Reportes propios | 43 reportes, tres páginas, otra cuenta rechazada, actualización persistida sin nota privada |
| Reportes administrativos | 53 del filtro + 25 fuera, tres páginas; cambio de estado/tipo/lista rechaza cursor |
| Notificaciones | 53 avisos propios en SQL del servicio Auth, tres páginas, empate de fecha, otra cuenta y cursor inválido |
| Conversaciones | D02 permite una sola pertenencia activa por usuario. Consulta limitada y cursor contextual; lista vacía tras retiro. No se elude la restricción de la BD para simular volumen imposible. |

Desde la raíz del repositorio, con las dependencias ya instaladas:

```powershell
.venv/Scripts/python.exe -I -B taller-de-integra-dos/roomies-web/backend/local_stack/run_e06.py --output "$env:TEMP/roomies-e06-qa" --browser-executable "$env:LOCALAPPDATA/ms-playwright/chromium-1255/chrome-win64/chrome.exe"
```

El runner registra resultados por categoría y genera ejemplos HTTP en `contracts/`. Adaptar la ruta del navegador instalado. Sin `--browser-executable`, el resumen indica que la prueba explícita E06 en navegador no se habilitó. Un código de salida cero de este runner solo acredita QA local.

Para regenerar únicamente ejemplos Convivencia:

```powershell
.venv/Scripts/python.exe -I -B taller-de-integra-dos/roomies-web/backend/services/convivencia-mensajeria-service/tests/run_isolated.py -k e06_export --e06-examples "$env:TEMP/roomies-e06-contracts"
```

## Ensayo físico pendiente: mismo Gateway, con TI4

Preparar tres cuentas de prueba confirmadas: dueño y dos residentes; una cuarta persona sin relación y una cuenta administrativa web. Obtener IDs a través del flujo real del entorno y registrar solo identificadores de prueba. Crear el arriendo mediante postulación → preselección → aceptación/incorporación; no insertar el arriendo manualmente.

1. Registrar responsable TI4, disponibilidad, dispositivo/SO, versión/build/SHA Expo, URL efectiva, SHA/digest de cada servicio y migraciones. Confirmar que Next publicado y Expo usan ese Gateway. Guardar captura del arranque e identificación sin JWT.
2. Desde el teléfono seleccionar una foto real y subirla al perfil. Consultar en web con otra sesión; reemplazar y recargar. Cancelar selector no debe enviar petición. Probar formato no admitido, archivo de tipo falso y red interrumpida: error claro y foto anterior conservada.
3. Crear aviso Arrendador con imágenes reales del selector, región/comuna de catálogo y precio entero CLP. Consultarlo desde web, editar conservando/quitando/agregando imágenes y recargar. Verificar rechazo de más de cinco archivos y exceso de bytes. No sustituir por un mock o URI local.
4. Postulante consulta catálogo/detalle y postula desde Expo. Dueño preselecciona y acepta desde web; móvil consulta su estado/arriendo real y cupos. Confirmar IDs iguales y persistencia después de reiniciar la pantalla.
5. Dos residentes envían mensajes, reintentan tras pérdida de red con el mismo `id_cliente` y recargan. Verificar historial con más de dos páginas y mensajes anteriores al ingreso excluidos.
6. Web crea una tarea asignada al residente. Expo la consulta y completa; web recarga y ve `Completada`. Un integrante distinto recibe 403 sin cambio. Capturar respuesta y lectura posterior de la misma tarea.
7. Recorrer las listas crecientes con más de dos páginas en el entorno de aceptación acordado: carga, más, error de siguiente página, reintento, fin sin botón adicional. Conservar filas/selección ante el error y comprobar IDs únicos.
8. Cambiar filtros, recurso y cuenta mientras una respuesta está retrasada. No mezclar filas ni cursores; una sesión nueva no reutiliza datos de la anterior. Cursor inválido o de otra lista/cuenta/filtro se rechaza con 422. No descargar todo para paginar localmente.
9. Dueño retira a un residente desde web con motivo/confirmación. Doble clic no retira dos veces. En Expo, chat/tareas/historial dejan de estar disponibles; tareas pendientes del retirado quedan sin asignar y pueden reasignarse. Probar lectura y escritura con el token que ya tenía.
10. Retirar al último residente: arriendo finalizado y publicación cerrada; recargar web y móvil confirma ambos. No reabrir automáticamente.
11. Móvil envía reporte de aviso ajeno y consulta seguimiento. Persona sin relación recibe 403 al reportar a otro usuario. Administrador web revisa el reporte; móvil recarga y ve el nuevo estado sin notas internas. Repetir una operación con la misma clave no duplica reportes.
12. Registrar evidencia por cliente/caso, resultado, IDs, versión y responsable de cada defecto. Si hay un bloqueo, corregir y repetir antes de aprobar B06. Coordinación B01 debe confirmar nominalmente la persona TI4; no completar firmas ni disponibilidad por inferencia.

Las tres correcciones técnicas E06-01/02/03 están resueltas; E06-04 conserva la coordinación y aceptación física descritas en [SCRUM-123](../SCRUM-123.md). No se completan firmas ni actas por inferencia.

Fuentes del cliente verificadas: `cf3fad659c64431dfe4fd3a567fde3e5b8b0f4eb`; [huellas y export Expo](../evidence/E06/sources-sha256.json).
