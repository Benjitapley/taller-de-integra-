# E05: verificacion del entorno publicado

Fecha: 26/11/2026, America/Santiago. Revision local de referencia: `bd8f788`. Se inspeccionaron las sesiones autorizadas de Kubero y Supabase y se ejecutaron consultas SQL de solo lectura. No se aplicaron migraciones, cambios de despliegue ni mutaciones de negocio.

**Destino confirmado posteriormente por el usuario: PostgreSQL de Kubero.** La inspeccion SQL real de `roomies-db-test2` confirma PostgreSQL 17.6, `ssl=off`, solo esquema `public` y tabla `public.prueba_persistencia_scrum100`. Solo existe el rol de Match entre los cuatro roles de servicios consultados. Faltan los esquemas y roles de Auth/Users, Listado y Convivencia; no basta aplicar las migraciones finales de E05. [Resultado de solo lectura en Kubero](kubero-sql-preflight.json).

Se corrigio localmente la seleccion de rutas completas de Auth/Users y Gateway en `ROOMIES_RUNTIME_MODE=kubero`, y se habilitaron los upstreams HTTPS configurados por el operador en ese modo. Se conserva la validacion del destino/rol SQL y la excepcion TEST sin TLS ya documentada. Comprobaciones: Auth 156 passed / 2 skipped (pruebas SQL opt-in), Gateway 192 passed, runtime compartido 189 passed. No se publicaron imagenes ni se atribuye esta correccion local al Gateway activo.

## Resultado

La aceptacion remota de E05 esta bloqueada por dependencias de despliegue y migraciones faltantes. No se ejecutaron retiros ni se presento como prueba integrada una consulta SQL aislada.

- Gateway TEST: `/health` responde 200; `/api/arriendos/mio` y `/api/publicaciones` responden **503**, sin token. El segundo es un catalogo publico. Esto no demuestra permisos de un usuario autenticado.
- Web publicada: la pagina inicial responde 200; no acredita conexion funcional con los servicios.
- Kubero, pipeline `roomies`, fase `test`: hay aplicaciones de administracion/base de datos, Gateway y Match. **No hay aplicaciones Auth/Users, Listado ni Convivencia** en esa fase.
- Gateway tiene solo las claves `ROOMIES_RUNTIME_MODE` y `MATCH_UPSTREAM_URL`; faltan los destinos de los servicios del recorrido.
- Imagen declarada del Gateway: `ghcr.io/cparra2007/roomies-api-gateway:sha-1267d9e`. El registro publica el digest `sha256:afd6e339836ea0a848e34bccb2d92e30e19c7aef4f04ebcc80a1d2f277d89c16` y etiqueta de revision `1267d9e7cc847262caa0f9cadfa986d4f7f768ba`. El digest consultado es el del tag en GHCR; no se obtuvo el `imageID` del contenedor activo, por lo que no se afirma equivalencia criptografica con el Pod.
- Imagen declarada de Match: `ghcr.io/cparra2007/roomies-match-conexion:sha-72e4bd6`. No es el servicio de retiro.

## Esquema Supabase observado

Proyecto autorizado: `erefnpvdjondjpcyjrpb`, PostgreSQL **17.6**. Las consultas se ejecutaron dentro de `BEGIN READ ONLY` y `COMMIT`, con el editor SQL. Los resultados completos no contienen credenciales ni contenido de usuarios.

- Existen `arriendo`, `pertenencia`, `incorporacion`, `outbox`, `conversacion`, `mensaje` y `tarea` en `convivencia_mensajeria`.
- Falta `arriendo.estado`, requerido para finalizar un arriendo.
- Faltan `retiro`, `retiro_outbox`, `expulsion` y `expulsion_outbox`.
- Falta el objeto `mensajes` utilizado por la version integrada de chat.
- `tarea.fecha_completada` y el trigger de desasignacion tras retiro ya existen.
- Los tres roles dedicados existen con LOGIN, sin SUPERUSER, CREATEDB, CREATEROLE ni BYPASSRLS.
- El historial del migrador solo muestra cuatro entradas, hasta `scrum111_perfil_comun` (`20261123214834`). Las migraciones de Convivencia aplicadas manualmente pueden no figurar en ese historial: se contrastaron sus objetos reales y no se dedujo su ausencia solo del historial.

Estos resultados confirman que no estan los prerrequisitos de las migraciones actuales de retiro. La evidencia anterior de E04 acredita un esquema inicial con tareas; no acredita E05.

## Siguiente paso necesario

1. Destino confirmado: `roomies-db-test2` en PostgreSQL de Kubero. La inspeccion anterior de Supabase se conserva como referencia del origen; no identifica la base conectada a los servicios futuros. El traslado de datos reales, con IDs y UUID preservados, corresponde a la migracion B03 y no puede darse por cumplido creando datos de demostracion.
2. Preparar los esquemas y roles faltantes en Kubero y conciliar/trasladar los datos que deban conservarse. No ejecutar el bootstrap desechable como sustituto de una migracion real. Luego revisar el cambio de mensajeria y las migraciones `005_retiro`, `006_tareas_reasignables` y `007_expulsiones`.
3. Construir/publicar versiones identificadas de Auth/Users, Listado, Convivencia y Gateway; desplegar los servicios con sus conexiones SQL existentes y configurar los upstreams del Gateway. El acceso a Kubero por si solo no aporta los DSN de Auth/Listado.
4. Con el candidato listo, preparar propietario y dos integrantes de prueba e ingresar por la API real. Comprobar motivo/confirmacion, doble retiro, revocacion de chat/tareas, reasignacion y ultimo integrante; registrar IDs ficticios, respuestas sanitizadas y SHA/digests.

Las operaciones 1-3 requieren preparar el entorno y exceden una comprobacion de solo lectura del despliegue existente. No se efectuaron en esta revision.

## Evidencia reproducible

- [HTTP publico previo al acceso administrativo](preflight.json).
- [Metadatos SQL y objetos observados](sql-preflight.json).
- [Inventario de Kubero TEST](kubero.json).
- [Consultas de solo lectura preparadas](../../../../backend/deploy/kubero/e05-preflight.sql).

Editor SQL utilizado: `https://supabase.com/dashboard/project/erefnpvdjondjpcyjrpb/sql/f2175cf5-cb6f-4b1a-b2a2-9806c49d4ab2`. El snippet contiene solo consultas de metadatos.
