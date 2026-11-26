# S3R-E01 · Auditoría del entorno y aceptación real

Fecha: 26/11/2026. Rama: `SCRUM-118`.

## Resultado de la auditoría

**Aceptación real bloqueada por configuración ausente.** Se notificó antes de
ejecutar pruebas contra PostgreSQL o servicios compartidos. No se usaron valores
de las plantillas como credenciales ni se modificaron usuarios, bases, permisos o
servicios del equipo.

| Requisito | Observación |
| --- | --- |
| Frontend `.env.local` | No existe |
| Variables activas de servicios | No se encontró `.env`, `.env.local` o `.env.roomies` en las ubicaciones auditadas de web/backend |
| Gateway real | URL no configurada; `API_GATEWAY_URL`, `FASTAPI_ORIGIN` y `WEB_AUTH_FASTAPI_ORIGIN` ausentes del proceso |
| PostgreSQL `127.0.0.1:5432` | TCP disponible; servicio Windows `postgresql-x64-19` en ejecución |
| `LISTADO_DATABASE_URL` | Ausente; sin verificar autenticación, base, rol ni migraciones |
| `PUBLICATIONS_TEST_ADMIN_DSN` | Ausente; no se ejecutó pytest contra `5432` |
| Storage compartido | Sin configuración activa de proyecto/credencial backend; `.env.example` contiene placeholders |
| Cuentas de prueba | No configuradas para esta ejecución |
| Contenedores | Docker no disponible en PATH; no se reinició ningún servicio ajeno |

La comprobación TCP no demuestra una conexión autenticada ni que el Gateway use
esa base de datos. Tampoco demuestra conectividad o persistencia de Storage.

## Variables que consume realmente el código

El frontend consume `FASTAPI_ORIGIN` para sus rewrites y
`WEB_AUTH_FASTAPI_ORIGIN` para su BFF; ambos deben identificar el mismo Gateway
real. `API_GATEWAY_URL` no se lee directamente en estas rutas: no basta con definir
solo esa variable.

Para la autenticación real también se necesitan `WEB_AUTH_ENABLED=true`,
`WEB_AUTH_ORIGIN`, `WEB_AUTH_PROVIDER=supabase`, `WEB_SUPABASE_ORIGIN`,
`WEB_SUPABASE_PUBLISHABLE_KEY`, `ROOMIES_RUNTIME_MODE`,
`ROOMIES_SUPABASE_PROJECT_REF` y el contrato de perfil compatible con el Gateway.
Nunca colocar una clave privilegiada en el frontend.

Listado consume `LISTADO_DATABASE_URL`, `ROOMIES_SUPABASE_PROJECT_REF` y
`ROOMIES_SUPABASE_STORAGE_KEY`, además de sus parámetros de identidad, destinos
internos y firma de cursores. Su adaptador fija el bucket `publicaciones` y deriva
la URL de Storage del proyecto; una variable genérica `STORAGE_URL` por sí sola
no configura este adaptador.

Las plantillas de `backend/services/.env.example` describen PostgreSQL remoto de
Supabase, no `127.0.0.1:5432`. Las validaciones de topología del runtime deben
conservarse: no se cambian flags ni se debilitan verificaciones de destino para
forzar una combinación no admitida. Al recibir la configuración real se verificará
qué topología usa el Gateway y si coincide con el PostgreSQL solicitado.

## Base dedicada y significado de las pruebas omitidas

La fixture SQL existente ejecuta bootstrap/migraciones y `TRUNCATE` de tablas de
Listado. `PUBLICATIONS_TEST_ADMIN_DSN` debe señalar una **base dedicada a pruebas**
en `127.0.0.1:5432`, preparada para estos casos, no la base con datos de usuarios.
El administrador de pruebas y `LISTADO_DATABASE_URL` deben apuntar a la misma base,
con sus respectivos roles.

`tests/run_isolated.py` arranca otro PostgreSQL temporal con puerto dinámico.
Aunque es SQL real, no acredita el servicio Windows del puerto 5432; no se usa
como sustituto de la aceptación solicitada.

Las tres omisiones anteriores de `npm test` correspondían a suites de navegador
que requieren `REPORTS_PLAYWRIGHT_PATH` y `REPORTS_BROWSER_PATH`. Esas suites usan
HTTP sintético, no una base real. Habilitarlas acredita regresión local y nunca
se contabiliza como aceptación del Gateway o Storage compartidos.

## Guion real pendiente

Ejecutar solo después de completar la configuración y registrar identidad del
entorno, versiones, responsables y cuentas de prueba sin credenciales.

1. Crear Arrendador: tres fotos del equipo JPEG/PNG/WebP menores de 5000000 bytes,
   precio 230000 y capacidad total 2. Registrar ID, IDs de imágenes y URLs públicas.
2. Editar con `imagenes_conservar` de una sola imagen; agregar otra y quitar dos;
   precio 245000. Confirmar dos imágenes en el DTO final y precio entero exacto.
3. Abrir URLs públicas desde un contexto limpio y consultar el aviso desde otra
   cuenta. La pantalla web actual requiere sesión; para lectura sin sesión, usar
   el GET público del Gateway y las URLs públicas de Storage. No presentar una
   redirección al login como aceptación de la pantalla anónima.
4. Reiniciar únicamente las instancias de Listado/Gateway identificadas para la
   prueba. Consultar de nuevo DTO, referencias y bytes de imágenes; documentar
   el mecanismo de reinicio y el resultado real.
5. Cerrar por PATCH; verificar `Cerrada`, mismas imágenes y lectura posterior.
6. Recorrer más de dos páginas reales; cambiar filtro y comprobar cursor nuevo;
   cupos exactos 2 excluyen avisos con 1 y 3 cupos disponibles.
7. Comuna inválida: 422 con error visible. Capacidad menor que ocupados/pendientes:
   409, conservando capacidad y estado previos. Requiere datos reales de admisión
   y Convivencia, no un stub de respuesta.
8. Cortar la petición de subida desde el navegador; conservar archivos, textos,
   IDs y clave de reintento; restaurar red y confirmar una única operación.

## Evidencia y criterio de cierre

Pendientes: respuestas HTTP reales sanitizadas, capturas con fotos del equipo,
prueba de segunda sesión y reinicio, resultados SQL en 5432, responsable TI4 y
versión/build móvil, SHA desplegado e identificación de migraciones/contrato.

Sanitizar antes de guardar: Authorization, cookies, JWT, claves, contraseñas y
credenciales en DSN. No conservar cuerpos de login ni archivos `.env` como evidencia.
Las capturas locales existentes están rotuladas como fixtures en
[la verificación local](../evidence/S3R-E01/verificacion-2026-11-26.md).

**No cerrar Jira ni marcar E01 aceptado mientras falte este recorrido real.**
