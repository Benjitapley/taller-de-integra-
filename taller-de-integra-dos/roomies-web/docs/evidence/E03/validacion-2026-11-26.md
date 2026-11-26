# SCRUM-120 / E03 — recorrido integrado local y aceptación en destino

Fecha: 26/11/2026. Base Git: `f422d84`; las correcciones de esta revisión permanecen sin commit. El resultado de la ejecución y las huellas SHA-256 de los archivos probados se registran en [integration.json](2026-11-26-local/integration.json); los casos del navegador están en [browser.json](2026-11-26-local/browser.json).

## Cambio funcional

El chat clasificaba un mensaje como propio comparando `nombre_remitente` con el nombre de la sesión. Dos personas llamadas igual aparecían como un único emisor. Se reprodujo en Edge con dos usuarios distintos llamados «Alex de prueba»: el envío y F5 funcionaron, pero falló la comprobación de autoría. Ahora compara `id_remitente` con el ID de negocio de la sesión. El perfil propio de transición incluye `id_usuario` para que el BFF pueda suministrar ese ID sin inferirlo del nombre o de los claims.

La corrección limpia también el ID de la sesión al revocar acceso o cambiar de cuenta.

## Entorno y límites

- Windows, PowerShell, Node 24.20.0, Next.js 16.4.3 y Edge sin interfaz.
- PostgreSQL 19 en un clúster temporal independiente, puerto libre y roles dedicados por servicio. Se aplican las migraciones del repositorio sobre una base vacía propia.
- Procesos reales e independientes de Auth/Users, Listado, Convivencia y Gateway; BFF y React reales en Next.js.
- **Identidad ficticia GoTrue/JWKS**, con JWT firmado y comprobado vía HTTP. No hay cuentas ni solicitudes a Supabase alojado en este ensayo.
- Publicaciones, pertenencias y mensajes iniciales se preparan como datos sintéticos SQL. No se acredita el flujo de postulación/incorporación F01/C03.
- Se inyecta una pérdida de respuesta después de recibir el resultado del backend real y se retrasa una respuesta real para comprobar el aislamiento entre sesiones.
- El ensayo no lee credenciales de PostgreSQL del usuario ni archivos `.env`. Sus procesos, junction de dependencias y clúster se retiran al finalizar; conserva las evidencias. No migra ni borra datos de `roomies_local` o de Kubero.

El primer intento de reutilizar la instancia local fue rechazado por su contraseña guardada. No se cambió esa contraseña ni la configuración del servidor; el runner definitivo usa exclusivamente su propio clúster.

## Reproducción

Desde la raíz de `roomies-web`, con las dependencias Python del proyecto, Node, Playwright, Edge y PostgreSQL instalados:

```powershell
python -B backend/local_stack/e03_acceptance.py --fixture-identity --evidence docs/evidence/E03/2026-11-26-local
```

`POSTGRES_BIN` permite seleccionar la carpeta de binarios PostgreSQL. `--fixture-identity` es obligatorio para dejar explícita la limitación del proveedor de identidad. Si falla un caso, el comando termina con error; un informe parcial del navegador no acredita cierre. Una ejecución completa genera ambos JSON y las capturas.

## Casos comprobados

- Enviar desde dos integrantes y recuperar ambos mensajes después de F5.
- Distinguir emisores por ID aunque tengan el mismo nombre.
- Recorrer 45 mensajes iniciales y dos mensajes nuevos en tres páginas, en orden y sin duplicados; excluir mensajes anteriores al ingreso y conservar la posición visual al cargar anteriores.
- Mostrar un envío como fallido cuando se pierde la respuesta después del commit; reintentar el mismo contenido/UUID y obtener una sola fila. Reutilizar el UUID con otro contenido devuelve 409.
- Denegar lectura y envío a terceros y al dueño no residente, tanto por BFF como por Gateway.
- Retirar a un integrante mediante HTTP autenticado del dueño y revocar lectura/envío; limpiar el contenido visible.
- Retener una respuesta y cambiar de cuenta: los mensajes anteriores no reaparecen.
- No producir excepciones JavaScript durante el recorrido.
- Reiniciar el proceso de Convivencia y recuperar el mensaje guardado; comprobar en SQL una sola fila del envío reintentado.

La lista exacta de comprobaciones y sus resultados está en los JSON de la ejecución. Las capturas muestran datos sintéticos:

- [Chat entre dos integrantes](2026-11-26-local/chat-dos-integrantes.png).
- [Envío fallido con reintento](2026-11-26-local/envio-reintentable.png).
- [Acceso retirado](2026-11-26-local/acceso-retirado.png).

## Regresión de la corrección

- Auth/Users: `python -I -B backend/services/auth-users-service/tests/run_isolated.py` — **155 aprobadas, 2 omitidas**, una advertencia de deprecación de Starlette/httpx.
- Frontend: `next typegen` y `tsc --noEmit` — aprobados.
- ESLint del componente de chat — aprobado.
- Sintaxis del runner de navegador y `git diff --check` — aprobados.

## Lo que impide aceptar en destino

Actualización posterior: el usuario facilitó el proyecto y las dos cuentas. Se verificó el login real de ambas; el [diagnóstico de Kubero](2026-11-26-hosted/README.md) registra el bloqueo vigente por servicios no desplegados y respuestas 503. El párrafo siguiente conserva el estado previo a recibir esos datos.

No se suministraron durante esta revisión dos identidades de prueba de Supabase ni se confirmó su configuración de staging. La disponibilidad de PostgreSQL Kubero y del Gateway desplegado tampoco se demuestra mediante este ensayo local. Se solicitó esa información mientras se completaban las comprobaciones independientes.

Para cerrar E03 se debe repetir el recorrido en ese entorno y registrar SHA/digests, migraciones, configuración pública, respuestas sanitizadas y actores de prueba. No sustituir las cuentas reales por esta fixture ni declarar probado Kubero a partir del clúster local.

[Jira SCRUM-120](https://alu-team-wgo3vx0z.atlassian.net/browse/SCRUM-120). La consulta pública de GitHub para localizar la PR devolvió HTTP 403; no se inventa un enlace ni se publica una PR con evidencia incompleta.
