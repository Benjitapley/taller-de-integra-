# E04: despliegue TEST

## Destino confirmado y preparacion de E05

El usuario confirmo PostgreSQL de Kubero como destino de negocio el 26/11/2026. La [inspeccion SQL real de Kubero](../../../docs/evidence/E05/2026-11-26-hosted/kubero-sql-preflight.json) encontro solo `public.prueba_persistencia_scrum100`; faltan los esquemas y roles de Auth/Listado/Convivencia. Los resultados de migraciones Supabase que siguen describen ese otro destino y no acreditan migraciones en Kubero.

La revision local actual habilita los contratos completos de Gateway y Auth/Users con `ROOMIES_RUNTIME_MODE=kubero`, sin habilitar `ROOMIES_LOCAL_MODE`, y los upstreams HTTPS del operador para los servicios. Para PostgreSQL Kubero utilizar su configuracion de destino y TLS/excepcion TEST documentada, no `ROOMIES_SUPABASE_DB_HOST`. Mantener Supabase como proveedor de identidad. La correccion no esta desplegada: faltan esquemas/roles, datos conciliados e imagenes publicadas.

Destino compartido confirmado: `https://roomies-gateway-test.inf.uct.cl`.
Proyecto Supabase: `erefnpvdjondjpcyjrpb`.

## Estado observado el 26/11/2026

- Acceso de administración a Kubero disponible. Solo se inspeccionó la fase TEST; no se guardaron cambios en Kubero.
- Gateway TEST listo con imagen `ghcr.io/cparra2007/roomies-api-gateway:sha-1267d9e`. Tiene únicamente `ROOMIES_RUNTIME_MODE=kubero` y `MATCH_UPSTREAM_URL`; no configura Auth/Listado/Convivencia.
- No hay apps Auth, Listado ni Convivencia en TEST. Hay tres apps de base de datos y Match.
- Las dos cuentas reales inician sesión en Supabase con HTTP 200 y correo confirmado. Con sus JWT, las rutas de perfil/arriendo del Gateway responden 503. El login del BFF publicado en Vercel también devuelve 503. [Evidencia sanitizada](../../../docs/evidence/E04/preflight-remoto-2026-11-26.json).
- Tras completar el inicio de sesión, se aplicaron las migraciones 001–005 de Convivencia y se creó su rol dedicado. Se corrigió la validación del bootstrap para aceptar únicamente la membresía administrativa inversa que Supabase agrega (`postgres` como miembro, grantor `supabase_admin`, sin INHERIT/SET). El runtime no pertenece a otros roles. [Evidencia de migración](../../../docs/evidence/E04/migracion-supabase-2026-11-26.json).
- La conexión real del rol nuevo funciona por pooler de sesión con `verify-full` y la CA oficial incluida en el runtime. Se comprobó que no puede leer Auth; su credencial quedó cifrada con DPAPI fuera de Git. Las claves existentes de Auth/Listado no se modificaron y sus DSN todavía deben proporcionarse para desplegarlos. [Conexión](../../../docs/evidence/E04/conexion-convivencia-2026-11-26.json).
- Una prueba SQL en Supabase comprobó creación/completado, desasignación tras retiro e historial completado. Se revirtió y no dejó filas; las secuencias de las tablas nuevas pueden avanzar tras el rollback. No acredita HTTP/Auth/Expo. [Resultado SQL](../../../docs/evidence/E04/sql-smoke-supabase-2026-11-26.json).
- No se encontró sesión de Vercel CLI ni enlace local de proyecto para editar el entorno publicado. La configuración local web/Expo ya apunta al Gateway TEST; eso no modifica Vercel ni resuelve sus respuestas 503.

## Imágenes

El [workflow preparado](../../../../../.github/workflows/e04-test-images.yml) construye Gateway, Convivencia, Auth y Listado en Linux, comprueba `/health` y publica imágenes GHCR con el SHA completo. No usa credenciales reales ni accede a Supabase durante el build. Se inicia al publicar la rama `deploy/e04-kubero-test`; también admite ejecución manual cuando GitHub registra el workflow.

Los contextos y el YAML se comprobaron localmente. Los manifiestos de las imágenes base de Python responden 200 en Docker Hub. No se ha ejecutado el workflow ni construido/publicado imágenes en esta revisión: falta la autorización solicitada para publicar la rama.

Tras un build aprobado, usar los **digests reales** del resumen de cada job. El primer paquete GHCR puede quedar privado; antes de editar Kubero, comprobar acceso de pull desde el clúster o configurar una credencial estable de lectura. No usar el `GITHUB_TOKEN` temporal de un job como credencial permanente.

La salud HTTP del contenedor solo demuestra que inicia, no que sus conexiones SQL/Auth estén listas.

## Migración

1. Obtener acceso SQL del proyecto TEST. Abrir el [preflight de solo lectura](e04-preflight.sql) en el SQL Editor o ejecutarlo con una conexión PostgreSQL autorizada y TLS verificado.
2. Confirmar el esquema existente y el rol dedicado. No aplicar ciegamente todo el historial a una base que ya tiene tablas. No usar `disposable`/identidad simulada en Kubero para eludir la configuración real.
3. **Este proyecto ya tiene aplicadas 001–005**; no repetirlas. Para otro destino que tenga 001–004 y no tenga `tarea`, aplicar [005_tareas.up.sql](../../services/convivencia-mensajeria-service/migrations/005_tareas.up.sql) tras el preflight. Si faltan prerrequisitos, revisar primero las migraciones y el rol. Las huellas de las cuatro tablas de negocio existentes coincidieron antes y después de la aplicación.
4. La conexión de `sql_convivencia_mensajeria` está preparada. Faltan los DSN existentes de `sql_auth_users` y `sql_listado_applications`; no rotarlos sin autorización porque afectaría sus conexiones actuales. Usar `sslmode=verify-full` y la [CA oficial del runtime](../../service_runtime/certs/README.md). Se observaron `haycupo`, `auth_users` y `listado_applications`; confirmar `ROOMIES_PERSISTENCE_LAYOUT=haycupo-v1` al desplegar Auth/Listado. La clave publishable no reemplaza los DSN.

## Variables de despliegue

Usar `ROOMIES_RUNTIME_MODE=supabase` para el código actual de los servicios. Configurar proyecto, proveedor Auth y claves públicas desde la configuración autorizada. Guardar passwords/DSN/token interno exclusivamente en los secretos del entorno.

| Componente | Configuración necesaria |
| --- | --- |
| Gateway | `AUTH_USERS_UPSTREAM_URL`, `LISTADO_UPSTREAM_URL`, `CONVIVENCIA_UPSTREAM_URL`; conservar Match existente. Puerto 8000. |
| Convivencia | `CONVIVENCIA_DATABASE_URL`, `ROOMIES_SUPABASE_DB_HOST`, `ROOMIES_SUPABASE_PROJECT_REF`, `ROOMIES_AUTH_PROVIDER_URL`, `AUTH_USERS_UPSTREAM_URL`, `LISTADO_UPSTREAM_URL`, `ROOMIES_INTERNAL_TOKEN`. |
| Auth | DSN `AUTH_USERS_DATABASE_URL`, layout real, proyecto/proveedor Auth, clave publishable y configuración de perfil. Agregar las claves backend adicionales que requieran las funciones habilitadas; nunca incluirlas en Expo. |
| Listado | DSN `LISTADO_DATABASE_URL`, proyecto/proveedor Auth, upstreams Auth/Convivencia, token interno y secreto estable de cursores. |
| Next publicado | `WEB_AUTH_ENABLED=true`, `WEB_AUTH_PROVIDER=supabase`, `WEB_PROFILE_CONTRACT=v1`, `WEB_AUTH_ORIGIN=https://taller-de-integra-frontend-next.vercel.app`, `WEB_AUTH_FASTAPI_ORIGIN` y `FASTAPI_ORIGIN` con el Gateway TEST; proyecto, origen y clave publishable de Supabase. Requiere actualizar entorno/redeploy de Vercel. |
| Expo | `EXPO_PUBLIC_API_URL` con el mismo Gateway, `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY`. Configurado localmente en el archivo ignorado `.env.local`; recargar la app tras usarlo. |

Los upstreams de los servicios en modo Supabase validan destinos HTTPS públicos; los nombres internos específicos de Kubero no están en su lista local de hosts. Elegir URLs HTTPS de las apps reales o revisar explícitamente esa configuración. El Gateway sí permite upstreams internos HTTP. No mezclar una identidad Supabase con IDs de otra base.

## Aceptación

Con servicios y pertenencias reales listos: A crea/asigna a B en la interfaz web; B lista y completa desde Expo en un celular físico; A vuelve a la web y comprueba persistencia. Registrar URL, SHA/digests, versión instalada y dispositivo. Probar 403 de no asignado/retirado, 422 de asignado inválido, desasignación tras retiro y fallo de PATCH sin falsa confirmación. No retirar cuentas de un arriendo ajeno para fabricar evidencia: usar datos de prueba creados para este recorrido.

La prueba física queda pendiente de identificar y conectar un dispositivo compatible. No se sustituyó por un navegador ni se acreditan esos casos remotos con los resultados locales.
