# SCRUM-94 · Perfil y migración de identidad

## Contrato de perfil

En modo Supabase, `GET` y `PATCH /usuarios/me` comparten implementación con `/api/v1/perfil` y `/local/v1/perfil`. Tanto la consulta como la edición devuelven el DTO privado de SCRUM-93. `verificado` representa la confirmación del correo en Supabase. Si un perfil heredado carece de fecha de nacimiento utilizable, se devuelve `edad: null` y `edad_calculada: false`.

La consulta requiere un Bearer válido. La edición JSON, la edición multipart y la inicialización requieren además correo confirmado, conforme a la regla específica de provisión de SCRUM-93. El PATCH conserva campos omitidos, borra valores con nulo o texto en blanco y admite `presupuesto` y `zona_interes`. La inicialización acepta fechas en formato ISO y edades entre 18 y 120 años, y devuelve siempre el ID Roomies que ya esté asociado al UUID.

La web en modo Supabase usa `/api/v1/perfil` para consultar y guardar. Ese alias ya entregaba el DTO de consulta en SCRUM-93 y permite actualizar la web y Auth/Users por separado.

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
