# SCRUM-101 · Ensayo de concurrencia de 053

Preparado, sin ejecutar. El destino propuesto es exclusivamente el PostgreSQL desechable principal de SCRUM-101, con autorización explícita posterior para confirmar la semilla y los casos indicados. No usar el laboratorio de Match. La limpieza requiere una segunda autorización explícita, vinculada al inventario final. Mantener detenidos los clientes del servicio durante todo el ciclo.

Antes de abrir A y B, verificar que el contenedor en ejecución sea `9f469c91d95bfc5f7ef316906e0b2a8c0873d8684b601b59d829def9b1a0332f`, con digest `sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929`, etiqueta `roomies.scrum101.run=scrum101-pg176-15e89e0eaee2`, red `none` y sin puertos. Exigir consumo exclusivo de `scrum101-pg176-15e89e0eaee2-data`, montado en `/var/lib/postgresql/data`, y solo los bind mounts de lectura de propuestas y secreto ya aprobados. Cotejar SHA-256 local y montado del SQL y sus includes contra las copias revisadas. A y B usan psql por socket Unix, con `-X -w -v ON_ERROR_STOP=1 -v scrum101_system_id=7711930340736987174` y el mecanismo de credencial existente, sin imprimirlo. No sustituir el identificador aprobado por una lectura nueva.

En la sesión inicial de solo lectura ejecutar `053-convivencia-verify.sql` para confirmar ACL, 16 políticas y los controles de Auth, Listado y Match. Comparar la captura estructural con la referencia aprobada de 053. Confirmar que las seis tablas están vacías y que no hay otros clientes, trabajadores incompatibles ni transacciones preparadas. Durante los casos solo pueden estar A, B y la sesión autorizada de observación. El SQL de las fixtures escribe únicamente tablas de Convivencia, con FK internas y sin llamadas a otros servicios. Las referencias a IDs de usuarios o publicaciones son ficticias. Configurar cada terminal:

```sql
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '15s';
SET idle_in_transaction_session_timeout = '60s';
SET TimeZone = 'UTC';
SELECT pid, backend_start FROM pg_stat_activity WHERE pid = pg_backend_pid();
```

Generar una sola vez `run_nonce` con 128 bits aleatorios mediante `python -B -c "import secrets; print(secrets.token_hex(16))"`. Registrar desde cada sesión administrativa su PID y `backend_start` antes de cambiar de rol. En A cargar `pid_a`, `start_a`, `pid_b` y `start_b` mediante `\set`, conservando la zona del timestamp y entrecomillando el valor completo, por ejemplo `\set start_b '2026-11-26 12:00:00.123456+00'`. El ejemplo es ficticio. Ambas sesiones reciben el mismo `run_nonce`, su propio `slot` (`A` o `B`) y el número `scenario` (1–4). Si alguna sesión se desconecta, detener la serie. Una reconexión no conserva la identidad registrada.

Si un controlador lee la sesión interactiva por una tubería, pasar `-v PROMPT1= -v PROMPT2= -v PROMPT3=` a psql desde el arranque. La salida del prompt puede compartir línea con el marcador de respuesta y hacer que el lector descarte un marcador válido. Exigir el marcador completo en una línea y, por separado, la identidad verificada de cada sesión. Ante EOF, fallo del lector o timeout, registrar la fase y la sesión, y cerrar ambos procesos antes de continuar con cualquier otra inspección.

Al abrir cada transacción hacer `BEGIN ISOLATION LEVEL READ COMMITTED;` y ejecutar `\i /scrum101/checks/target.sql` y `\i /scrum101/checks/convivencia-target.sql`. Adoptar `sql_convivencia_mensajeria` en los pasos de runtime y `scrum101_owner` en la semilla y los retiros de control. Para cada escenario, antes de la primera operación de A o B, ejecutar `\i /scrum101/tests/convivencia-concurrency-session.sql`. Este include exige el rol efectivo que corresponde a escenario y sesión y emite `SESION` junto al PID y una marca local de transacción que incorpora ese rol. Cotejar PID y marca. No cambiar de rol entre ese control y la operación de negocio.

En los casos 1–3, tras enviar la sentencia de B, observar que espera durante una ventana máxima de tres segundos. Si se observa, ejecutar desde **la misma sesión A** `\i /scrum101/tests/convivencia-concurrency-gate.sql`. Es la única vía de confirmación de A durante esos casos. El include hace `RESET ROLE` para observar el catálogo como administrador sin liberar los bloqueos, y vuelve a cotejar ambos PID, sus `backend_start`, las marcas, la base y el socket. Requiere que B esté en una espera de bloqueo y que `pg_blocking_pids(B)` contenga solo a A. Si falla, el include revierte y cierra A. Revertir también B aunque su consulta haya terminado al liberarse A.

Un timeout, desconexión, error inesperado o COMMIT ambiguo obliga a detener todos los casos, cerrar las sesiones e inspeccionar en solo lectura. Las respuestas esperadas de B y el inventario de etapa siguen siendo obligatorios incluso si pasó la observación de bloqueo. No limpiar ni reintentar automáticamente.

## Semilla exclusiva

En A, iniciar una transacción con los guards indicados y adoptar el owner. La semilla necesita COMMIT para ser visible desde B. Ejecutar el bloque completo; cualquier aserción fallida debe llevar a ROLLBACK:

```sql
LOCK TABLE convivencia_mensajeria.incorporacion, convivencia_mensajeria.arriendo,
    convivencia_mensajeria.pertenencia, convivencia_mensajeria.outbox,
    convivencia_mensajeria.conversacion, convivencia_mensajeria.mensaje
    IN SHARE ROW EXCLUSIVE MODE;
DO $empty$
BEGIN
    IF EXISTS (SELECT FROM convivencia_mensajeria.incorporacion)
       OR EXISTS (SELECT FROM convivencia_mensajeria.arriendo)
       OR EXISTS (SELECT FROM convivencia_mensajeria.pertenencia)
       OR EXISTS (SELECT FROM convivencia_mensajeria.outbox)
       OR EXISTS (SELECT FROM convivencia_mensajeria.conversacion)
       OR EXISTS (SELECT FROM convivencia_mensajeria.mensaje)
    THEN RAISE EXCEPTION 'Convivencia debe estar vacía'; END IF;
END;
$empty$;
INSERT INTO convivencia_mensajeria.incorporacion(id_operacion,payload)
SELECT ('00000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, '{"scrum101":"053-concurrency"}'
FROM generate_series(953101,953106) g;
INSERT INTO convivencia_mensajeria.arriendo(id_publicacion,cupos_totales,version_capacidad)
VALUES (953201,1,1),(953202,1,1),(953203,1,1);
INSERT INTO convivencia_mensajeria.conversacion(id_arriendo)
SELECT id_arriendo FROM convivencia_mensajeria.arriendo WHERE id_publicacion IN (953201,953202);
INSERT INTO convivencia_mensajeria.pertenencia(id_arriendo,id_usuario,id_postulacion,id_operacion)
SELECT id_arriendo, id_publicacion+100, id_publicacion+200,
       ('00000000-0000-4000-8000-' || lpad((id_publicacion-100)::text,12,'0'))::uuid
FROM convivencia_mensajeria.arriendo WHERE id_publicacion IN (953201,953202);
INSERT INTO convivencia_mensajeria.outbox(id_operacion,accion,reserva)
VALUES ('00000000-0000-4000-8000-000000953105','Confirmar','{}'),
       ('00000000-0000-4000-8000-000000953106','Liberar','{}');
COMMIT;
```

Antes de iniciar el escenario 1, capturar y validar `01-semilla.json` como se indica al final. La evidencia de semilla tiene que aprobar para continuar.

## 1. Envío antes del retiro

A como runtime bloquea la pertenencia activa y ejecuta el INSERT de mensaje sin confirmar:

```sql
DO $send$
DECLARE
    rental bigint;
    membership bigint;
    chat bigint;
    sent bigint;
BEGIN
    SELECT id_arriendo INTO STRICT rental FROM convivencia_mensajeria.arriendo
    WHERE id_publicacion=953201;
    SELECT id_conversacion INTO STRICT chat FROM convivencia_mensajeria.conversacion
    WHERE id_arriendo=rental;
    SELECT id_pertenencia INTO STRICT membership FROM convivencia_mensajeria.pertenencia
    WHERE id_arriendo=rental AND id_usuario=953301 AND estado='Activa' FOR SHARE;
    INSERT INTO convivencia_mensajeria.mensaje(id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente)
    VALUES (chat,953301,'Actor sintético','Envío previo','00000000-0000-4000-8000-000000953601')
    RETURNING id_mensaje INTO STRICT sent;
    RAISE NOTICE 'Pertenencia bloqueada: %, mensaje sin confirmar: %', membership, sent;
END;
$send$;
```

Si falta la pertenencia activa o se devuelve más de una fila, `INTO STRICT` aborta antes del INSERT. Revertir A y detenerse. Tras el aviso de éxito, B como owner ejecuta `UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_usuario=953301 AND estado='Activa' RETURNING terminada_en;`. Debe esperar a A. Usar la compuerta de bloqueo para confirmar A y exigir una fila con fin en B. En B, comprobar que el mensaje de A ya es visible y que la actualización produjo un intervalo válido, luego **ROLLBACK de B**. Solo A precisa COMMIT para demostrar que un envío confirmado precede al retiro. La sesión independiente debe ver un mensaje con el UUID sintético y la pertenencia aún activa con fin nulo.

## 2. Retiro antes del envío

A como owner ejecuta `UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_usuario=953302 AND estado='Activa' RETURNING terminada_en;`. Exigir una fila con fin antes de iniciar B. B como runtime ejecuta `SELECT creada_en FROM convivencia_mensajeria.pertenencia WHERE id_usuario=953302 AND estado='Activa' FOR SHARE;`. Confirmar A solo con la compuerta de bloqueo y exigir cero filas en B. El COMMIT de A es necesario para que B observe el retiro. B termina con ROLLBACK sin lanzar INSERT. Comprobar en otra sesión el intervalo y que ese remitente no tiene mensajes. La respuesta HTTP corresponde a una prueba aparte.

## 3. Última plaza

En ambas sesiones usar el runtime. A inicia la transacción y ejecuta:

```sql
INSERT INTO convivencia_mensajeria.pertenencia(id_arriendo,id_usuario,id_postulacion,id_operacion)
SELECT id_arriendo,953303,953403,'00000000-0000-4000-8000-000000953103'
FROM convivencia_mensajeria.arriendo WHERE id_publicacion=953203;
```

Exigir `INSERT 0 1` en A antes de iniciar B. B ejecuta la misma operación con `953304`, `953404` y `00000000-0000-4000-8000-000000953104`. Confirmar A solo con la compuerta de bloqueo. El COMMIT es necesario para que B cuente la última plaza ocupada. En B interactivo registrar el SQLSTATE con `\errverbose` y exigir `23514`, diagnóstico «Capacidad agotada» y contexto de `validar_cupo()`. Otro CHECK, una violación de FK, unicidad o un timeout no aprueban el caso. Revertir B. Este caso prueba el trigger al insertar directamente, sin invocar la incorporación HTTP ni modificar la versión de ocupación.

## 4. SKIP LOCKED

Ambas sesiones usan el runtime. A ejecuta `SELECT id_outbox FROM convivencia_mensajeria.outbox WHERE accion='Confirmar' FOR UPDATE;`. B ejecuta:

```sql
SELECT accion FROM convivencia_mensajeria.outbox
WHERE NOT enviado ORDER BY ultimo_intento NULLS FIRST,id_outbox LIMIT 20 FOR UPDATE SKIP LOCKED;
```

Exigir que B devuelva inmediatamente solo `Liberar`. Dejar B abierta y sin emitir otras consultas. Ejecutar en A el mismo include de comprobación con `scenario=4`. En este caso exige a B identificada, dentro de su transacción y sin bloqueadores, y revierte A. Revertir B. Repetir la consulta en una transacción nueva en B, con guard y rol verificados, y exigir ambas acciones antes de revertir. Comprobar que las filas conservan su estado de entrega. Este caso demuestra la exclusión de filas bloqueadas, sin invocar el worker ni los servicios HTTP.

## Verificación independiente e inventario para limpieza

En sesiones nuevas de solo lectura, después de cada caso, comprobar las filas correspondientes con los guards de identidad. Ejecutar estas consultas y cotejar los resultados descritos:

```sql
SELECT id_usuario,estado,terminada_en IS NULL AS sin_fin,
       terminada_en >= creada_en AS fin_valido
FROM convivencia_mensajeria.pertenencia WHERE id_usuario IN (953301,953302,953303,953304) ORDER BY id_usuario;
SELECT m.id_remitente,m.id_cliente,a.id_publicacion
FROM convivencia_mensajeria.mensaje m
JOIN convivencia_mensajeria.conversacion c USING(id_conversacion)
JOIN convivencia_mensajeria.arriendo a USING(id_arriendo)
WHERE m.id_remitente IN (953301,953302);
SELECT p.id_usuario,p.estado FROM convivencia_mensajeria.pertenencia p
JOIN convivencia_mensajeria.arriendo a USING(id_arriendo)
WHERE a.id_publicacion=953203;
SELECT id_operacion,accion,enviado,ultimo_intento
FROM convivencia_mensajeria.outbox ORDER BY accion;
```

Tras los cuatro casos, exigir exactamente seis incorporaciones marcadas por payload, tres arriendos, tres pertenencias (953301 activa, 953302 inactiva y 953303 activa), dos conversaciones, un mensaje con UUID de cliente terminado en 953601 y dos eventos de outbox sin enviar. Registrar PIDs, bloqueos, conteos y resultados de COMMIT/ROLLBACK. Si falta una fila o sobra otra, detenerse. Un resultado parcial necesita una autorización de recuperación distinta.

### Compuerta de inventario tras cada etapa

Tras la semilla y cada caso, una vez terminadas las transacciones de A y B, abrir una sesión administrativa nueva con psql `-X -qAt`, los guards de destino y el identificador aprobado. Enviar el siguiente bloque. Suprimir la salida de los guards y guardar stdout como **una sola línea UTF-8 sin BOM**, fuera del repositorio y sin imprimir el JSON:

```sql
\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TimeZone = 'UTC';
\o /dev/null
\i /scrum101/checks/target.sql
\i /scrum101/checks/convivencia-target.sql
\i /scrum101/tests/convivencia-concurrency-inventory.sql
\o
\echo :fixture_rows
ROLLBACK;
```

Guardar por orden `01-semilla.json`, `02-envio.json`, `03-retiro.json`, `04-cupo.json` y `05-skip-locked.json`. Conservar los originales. Tras cada captura, ejecutar `python -B tests/validate_convivencia_concurrency.py` desde el directorio de SCRUM-101 con **todas** las capturas acumuladas y en ese orden. Exigir código 0 y la línea de inventario exacto de la etapa actual antes de continuar. El validador revisa la semilla mediante claves lógicas y valores exactos, registra las identidades reales generadas y solo permite el cambio previsto en cada etapa posterior. Cualquier fila faltante, adicional, duplicada o modificada fuera de ese cambio obliga a parar. No mostrar los archivos si el control falla.

Solo con las cinco capturas válidas se emite `fixture_sha256`, calculado sobre el JSON final original sin el terminador de línea. La autorización de limpieza debe identificar ese SHA-256 y el ID completo del contenedor.

Solo con esa autorización separada, ejecutar `tests/convivencia-concurrency-cleanup.sql` por el socket del mismo ID, pasando `-v approved_fixture_sha256=<huella aprobada>` además de la identidad del clúster. El script adquiere bloqueos, vuelve a cotejar la huella completa y elimina solo las claves sintéticas esperadas en orden hijo–padre. Rechaza actividad concurrente, FK entrantes de otros esquemas o con acciones de borrado distintas de NO ACTION, triggers de borrado no internos y reglas sobre esas tablas. Si los conteos o la huella difieren, aborta sin confirmar. No derivar una nueva huella como parte de la limpieza ni usar eliminación por patrones.

Tras COMMIT de limpieza, verificar por separado que las seis tablas están vacías, que 053 y los controles de Auth, Listado y Match siguen aprobando y que la captura estructural coincide con la inicial. Registrar los contadores de las cinco identidades; pueden avanzar incluso tras ROLLBACK. No reiniciarlos. Los ensayos SQL no acreditan autorización individual en la API, compensación remota ni comportamiento en Kubero TEST.
