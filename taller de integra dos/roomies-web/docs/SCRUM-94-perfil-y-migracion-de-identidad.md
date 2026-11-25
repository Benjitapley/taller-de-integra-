# SCRUM-94 · Perfil y migración de identidad

## Contrato de perfil

El Gateway publica `GET`, `POST` y `PATCH /api/usuarios/me`. La consulta y la edición amplían el DTO privado de SCRUM-93 con `id_usuario`, `fecha_nacimiento`, `presupuesto` y `zona_interes`. Se conservan los alias y sus formatos para la transición. `verificado` representa la confirmación del correo en Supabase. Si un perfil heredado carece de fecha de nacimiento utilizable, se devuelve `edad: null` y `edad_calculada: false`.

La consulta requiere un Bearer válido. La edición JSON, la edición multipart y la inicialización requieren además correo confirmado, conforme a la regla específica de provisión de SCRUM-93. El PATCH conserva campos omitidos, borra valores con nulo o texto en blanco y admite `presupuesto` y `zona_interes`. La inicialización acepta fechas en formato ISO y edades entre 18 y 120 años, y devuelve siempre el ID Roomies que ya esté asociado al UUID.

El BFF usa las rutas canónicas en modo Supabase. Para SCRUM-111, `PUT /api/usuarios/me/foto` recibe únicamente el archivo multipart `foto`, exige sesión y correo confirmado, y devuelve `{"foto_perfil":"<URL pública>"}`. El BFF distingue el guardado de los campos de texto del guardado de la foto.

## Activar Supabase Storage

1. En **Storage** del proyecto autorizado, crear el bucket público `perfiles`, con límite de 5 000 000 bytes y tipos `image/jpeg`, `image/png` e `image/webp`. Revisar que sus políticas no otorguen escritura directa a `anon` ni `authenticated`. El contrato permite lectura pública. La creación se hace desde Storage, mediante el Dashboard o su API.
2. Aplicar [la migración de limpieza](../backend/services/auth-users-service/migrations/003_profile_photo_cleanup.up.sql) después de aprovisionar el esquema `auth_users` y el rol `sql_auth_users`. Configurar `ROOMIES_PROFILE_STORAGE_SECRET_KEY` con una clave secreta `sb_secret_…` del mismo proyecto, solo en Auth/Users.
3. Verificar con una cuenta de pruebas confirmada que el PUT devuelve la URL, el GET devuelve la misma referencia y la imagen aparece en **Storage → perfiles** y en el perfil después de volver a iniciar sesión. Reemplazarla y comprobar que la URL cambia y la tarea de limpieza retira el objeto anterior.

Auth/Users valida el contenido y asigna una clave nueva bajo el UUID del usuario. En modo Supabase registra en PostgreSQL la URL pública y la limpieza pendiente. Si falla la actualización de PostgreSQL, la foto previa continúa referenciada y el candidato se recoge por la cola. Las referencias anteriores a `/imagenes/…` siguen siendo legibles mientras se conserve su volumen. En el laboratorio desechable, la foto se guarda en el directorio local de pruebas.

## Asociación de cuentas existentes

La identidad de acceso es el `sub` del JWT de Supabase. El identificador de negocio sigue siendo `haycupo.usuario.id_usuario`. En el layout `haycupo-v1` que usa `docker-compose.supabase.yml` por defecto, `auth_users.identidad` guarda la relación uno a uno.

1. Confirmar el esquema real de destino y las restricciones de unicidad y FK de `auth_users.identidad`. Si aún falta la tabla, revisar y ensayar primero la [propuesta aditiva de Sprint 2](../migration-proposals/sprint2-supabase/stage1-additive.sql). El layout con UUID en la propia fila de `auth_users.usuario` requiere revisar otro procedimiento.
2. Ejecutar el [preflight de solo lectura](../migration-proposals/sprint2-supabase/scrum94-preflight.sql). Verificar que un respaldo previo incluya las tablas afectadas y el estado de Auth necesario para reconciliar la migración. Probar la restauración en una base aislada y conservar su comprobante.
3. Preparar un lote privado con columnas `supabase_user_id,id_usuario`. Acreditar control de ambas cuentas mediante sus mecanismos de autenticación o un proceso de recuperación revisado por el operador. Registrar la evidencia y la revisión con acceso restringido. Una coincidencia de correo puede orientar la revisión, pero nunca autoriza una asociación.
4. Resolver antes de abrir la inicialización a una cohorte heredada. Los casos sin evidencia suficiente o con conflicto quedan para revisión. Si un UUID ya creó otro perfil, comparar las dependencias de ambos perfiles y acordar su resolución antes de cambiar vínculos. Para cuentas confirmadas clasificadas como nuevas, usar la inicialización normal. La inicialización de un UUID sin vínculo crea un ID nuevo, por lo que habilitarla antes de reconciliar la cohorte puede duplicar perfiles.

## Ensayo y aplicación

Pausar los escritores de perfiles y ejecutar como operador con permisos sobre las tablas necesarias. En la réplica restaurada, usar una sola sesión de `psql` con parada ante errores. Sustituir los marcadores de archivo y huella por los valores de ese entorno. Abrir la sesión en `migration-proposals/sprint2-supabase` para resolver la ruta del [script de vinculación](../migration-proposals/sprint2-supabase/scrum94-vincular.sql).

```sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL roomies.scrum94_approved = 'reviewed';
SET LOCAL roomies.backup_verified = '<sha256 del respaldo cuya restauración se verificó>';
CREATE TEMP TABLE scrum94_vinculos (supabase_user_id uuid, id_usuario integer) ON COMMIT DROP;
\copy pg_temp.scrum94_vinculos FROM '<ruta privada al CSV revisado>' WITH (FORMAT csv, HEADER true)
\i scrum94-vincular.sql
ROLLBACK;
```

El script devuelve solo conteos y conserva íntegra la fila heredada. Un par ya aplicado cuenta como existente. Si hay UUID o IDs repetidos en el lote, cuentas de Supabase no confirmadas, pares ausentes o un conflicto con vínculos existentes, se aborta la transacción completa.

Después de revisar el estado de la base real, el respaldo restaurado y el ensayo, repetir el procedimiento en la ventana acordada. Revisar los conteos antes de elegir `COMMIT`. Después, repetir el preflight y comprobar con cuentas autorizadas que `GET /usuarios/me` devuelve el perfil esperado y que `POST /api/v1/perfil/inicializacion` devuelve el ID heredado. Verificar que las publicaciones y conexiones previas siguen asociadas al mismo ID.

Si hay un problema antes del commit, ejecutar `ROLLBACK`. Si se descubre un error después, detener escritores y guardar el estado posterior. Revisar dependencias nuevas, incluidas sesiones revocadas y actividad de los usuarios, antes de restaurar o corregir los vínculos afectados. Quitar una asociación indiscriminadamente puede permitir que la inicialización cree un perfil duplicado.
