# SCRUM-101 · Preflight y provisionamiento de PostgreSQL 17.6

Esta carpeta contiene la cadena 000–062 del ensayo `private-v1`. El provisionamiento produce una base desechable vacía, con un propietario de objetos y cinco logins sin credenciales iniciales. Auth/Users instala su esquema y permisos sobre esa base provisionada. El contrato de tablas y datos está en la [matriz de migración](../../docs/deployment/scrum-101-matriz-migracion.md).

## Evidencia por entorno

El estado `prepared-not-executed` del manifiesto describe las propuestas versionadas. La ejecución se registra por destino en la tabla siguiente.

| Entorno | Fases | Revisión o huellas | Resultado | Alcance y limitaciones |
|---|---|---|---|---|
| Repositorio | 000–062 | Base `9dc8f10`. Los cambios de esta entrega están pendientes de incorporación. El manifiesto fija las fuentes y sus huellas donde corresponde. | Propuestas y verificadores disponibles. | El manifiesto no es un registro de instalación. |
| PostgreSQL 17.6 desechable principal | 000–062 | Evidencia de ejecución y verificadores registrada en SCRUM-101. Las fases ensayadas desde la base `9dc8f10` incluyen cambios locales. Huella del baseline estructural 053: `5f1cf80ae3299ec858ea5861cb3ce51d5a4e47c40ab03af2ada37001c95444a2`. | Migraciones instaladas y verificadas dentro del alcance ensayado. | En Match siguen pendientes el backfill histórico y la concurrencia dinámica. En Convivencia sigue pendiente la concurrencia de dos sesiones. |
| PostgreSQL 17.6 desechable principal, ensayo de Reportes | 060–062 | SHA-256 de `tests/reportes-behavior.sql` ejecutado: `ca857118708cf4f88b2975f472b26bb802b1faeccbb544839ac37a63917341b9`. | Ensayo SQL de una sesión, código 0 y ROLLBACK. Verificadores 062 y 053 aprobados después. | Valida permisos y ejecución de SQL, incluido SKIP LOCKED en una sesión. Quedan pendientes la contención entre sesiones y la entrega HTTP de avisos. |
| Kubero TEST | 000–062 y carga histórica | Sin revisión ni huellas de instalación acreditadas para SCRUM-101. | Instalación, carga histórica e integración pendientes de verificación. | La evidencia del desechable corresponde únicamente a ese entorno. |

## Preparación del primer ensayo Docker

1. Usar una instancia nueva con imagen PostgreSQL 17.6 aprobada y fijar su digest para reproducibilidad. Usar almacenamiento temporal exclusivo y red deshabilitada, sin publicar puertos ni montar almacenamiento de desarrollo o compartido. Montar esta carpeta en solo lectura. Ejecutar `psql` dentro del contenedor por socket Unix. El socket limita el transporte, pero también hay que comprobar el aislamiento y la procedencia del volumen antes de arrancar.
2. El responsable de infraestructura provisiona el login superusuario exclusivo del clúster de ensayo y crea, como administrador, una base nueva desde `template0` con nombre `roomies_scrum101_disposable`. Establece el comentario de base exacto `SCRUM-101 disposable private-v1`. Estos son requisitos previos fuera de los scripts. El guard exige la versión exacta 17.6 y admite las bases estándar, además del destino. La marca declara intención y debe acompañarse de la verificación del clúster.
3. Usar el mecanismo de secretos del entorno Docker para el administrador, por ejemplo un archivo secreto efímero y de acceso restringido compatible con `POSTGRES_PASSWORD_FILE` al inicializar la imagen. Preparar autenticación local restringida y usar un prompt interactivo o un archivo de contraseñas temporal protegido (`PGPASSFILE`, permisos 0600) cuando corresponda. No usar autenticación `trust`, ni llevar secretos a argumentos, repositorio, manifiesto o logs. Asegurar que el cliente no hereda un destino de otra sesión.
4. Mantener los cinco logins de runtime sin contraseña en 010. Antes de futuras pruebas de login, el administrador puede asignar credenciales de ensayo mediante el comando interactivo de psql para establecer la contraseña, con SCRAM, o usar autenticación local por identidad del sistema con mapeo explícito. Es una acción posterior, fuera de estos scripts. `scrum101_owner` es `NOLOGIN`; el administrador aislado podrá seleccionar ese rol para crear objetos de dominio en fases futuras. No conceder membresías a los runtimes.

El superusuario es una precondición explícita de esta implementación. Se usa para crear roles a nivel clúster y controlar las ACL de la base y del esquema `public`. El propietario de objetos recibe `CREATE` y `CONNECT` en la base, sin recibir su propiedad ni privilegios administrativos. Cada runtime recibe únicamente `CONNECT` en esta fase. Las conexiones de mantenimiento se limitan a la base desechable. El runner presupone `psql`, porque los entrypoints usan inclusiones relativas al archivo.

## Procedimiento futuro y criterio de parada

Invocar cada entrypoint por separado con `psql -X -d roomies_scrum101_disposable -f ARCHIVO`, usando el login administrador ya preparado y conexión por socket dentro de la instancia aislada. No usar una transacción externa de psql. Los scripts declaran sus propias transacciones y abortan al primer error.

| Orden | Archivo | Contrato |
|---|---|---|
| 000 | `000-preflight.sql` | Transacción de solo lectura. Comprueba versión, destino marcado, conexión local, identidad del administrador, ausencia de roles reservados, esquemas inesperados, objetos dependientes de `public`, extensiones adicionales y triggers de eventos. Ante conflicto, termina con error. |
| 010 | `010-provision.sql` | Transacción única con un bloqueo asesor por base. Repite los guards antes de crear roles. Revoca acceso de `PUBLIC` a la base y a `public`, concede permisos acotados y restringe los defaults del propietario para funciones y tipos. Ejecuta comprobaciones antes del commit. |
| Verificación | `010-verify.sql` | Transacción de solo lectura independiente. Comprueba destino, atributos y membresías de los seis roles, privilegios efectivos y defaults. Ejecutar inmediatamente después de 010. |
| Orden de ejecución | `manifest.json` | Manifiesto de versión 1 con identidad del destino, orden, precondiciones, comprobaciones y archivo de verificación. |

Los archivos en `checks/` son inclusiones internas. El preflight comprueba una lista de condiciones de catálogo, que no acredita por sí sola que un clúster sea nuevo o que su autenticación sea segura. Las ACL verificadas corresponden a la base objetivo y su esquema `public`; no hay tablas de negocio ni políticas RLS en esta fase. Un segundo intento de provisionamiento sobre un clúster aplicado debe detenerse al encontrar roles reservados. Ante un fallo, conservar diagnósticos sanitizados y repetir en una instancia desechable nueva y confirmada. Los scripts carecen de operaciones de borrado de bases o roles.

## Validación estática

Desde esta carpeta, ejecutar `python -B -m unittest -v test_static`. Solo se usa la biblioteca estándar. Las pruebas leen el manifiesto y los SQL para comprobar el orden, las inclusiones, los guards, las transacciones, los roles, los grants y la ausencia de operaciones fuera de alcance. La validación de sintaxis PL/pgSQL y de permisos efectivos queda para el ensayo posterior en PostgreSQL 17.6.

## Ensayo futuro de Auth/Users (020–022)

Antes de ejecutar, comprobar el ID, el volumen exclusivo, la red deshabilitada, el montaje en solo lectura en `/scrum101` y la identidad del servidor y de la base. Confirmar 010 desde una sesión independiente con su verificador y ejecutar las pruebas estáticas en el worktree. Los pasos de Auth comprueban destino y estado posterior a 010. El preflight 000 exige ausencia de esos roles y queda fuera de esta secuencia.

Desde el contenedor autorizado invocar cada archivo por separado con `psql -X -h /var/run/postgresql -p 5432 -U scrum101_admin -d roomies_scrum101_disposable -v ON_ERROR_STOP=1 -f /scrum101/ARCHIVO`, usando el mecanismo de autenticación efímero. Exigir salida 0 antes de avanzar. Los tres pasos de escritura son transacciones independientes. Ante error o desconexión, inspeccionar el catálogo en solo lectura antes de decidir cómo continuar. Una repetición desde cero se ensaya en otro clúster desechable.

| Orden | Archivo | Resultado esperado |
|---|---|---|
| 020 | `020-auth-base.sql` | Comprueba integridad de Auth 001 antes del cambio de rol. El propietario crea el esquema, `usuario`, su identidad y la unicidad UUID. |
| 021 | `021-auth-extensions.sql` | Añade presupuesto y zona a `usuario`, más notificaciones, revocaciones, perfil común y cola de limpieza de fotos. |
| 022 | `022-auth-acl.sql` | Aplica grants mínimos por columna y acción, acceso a ambas secuencias y políticas RLS por operación. Comprueba los permisos antes de confirmar. |
| Verificación | `022-auth-verify.sql` | Comprueba catálogo, columnas, restricciones, propietarios, secuencias, RLS y permisos efectivos en solo lectura. |
| Comportamiento | `tests/auth-behavior.sql` | Ensayo sintético opt-in. Usa `SET LOCAL ROLE`, comprueba altas, reintentos, bloqueos, operaciones prohibidas y aislamiento entre roles. Ejecutar solo cuando se autorice escritura sintética. El rollback revierte filas, pero las secuencias pueden avanzar. |

La copia de Auth 001 bajo `upstream/` permite usar el montaje existente, que solo expone esta carpeta. La prueba estática compara la copia y el original normalizando CRLF a LF. 020 comprueba la huella SHA-256 normalizada dentro del servidor antes de incluir la copia. El proceso PostgreSQL debe poder leer ese archivo. El wrapper controla la transacción y cambia a `scrum101_owner` después de comprobar la sesión administradora. El paso 022 expresa sus ACL directamente porque Auth 002 concede lectura de tabla completa y solo cubre el adaptador básico. Ninguno de los pasos crea roles propios de Supabase ni toca las migraciones originales.

El ensayo cubre el adaptador básico y el ampliado. SCRUM-102 debe confirmar las rutas y la configuración efectiva del adaptador en Kubero, incluido el modo SSL. Las políticas representan al rol del servicio. La autorización de cada usuario se comprueba en la API. `perfil_comun` y `foto_limpieza` conservan la semántica de SCRUM-111. La conciliación de UUID, geografía y referencias a archivos queda para los datos autorizados. El alcance de 020–022 es Auth. Los permisos de `PUBLIC` observados en las bases estándar requieren un paso de endurecimiento separado.

## Ensayo futuro de Listado/Applications (030–034)

El destino es `private-v1`. Fijar `ROOMIES_PERSISTENCE_LAYOUT=private-v1` en la futura configuración del servicio. Los SQL usan nombres privados fijos y rechazan la presencia de `haycupo`. Antes de ejecutar, verificar contenedor, socket, marca, digest, rama y huellas de los archivos montados. Usar los mismos argumentos de psql y el mecanismo efímero de Auth. Ejecutar cada archivo por separado, con salida 0 obligatoria antes de pasar al siguiente. No usar una transacción exterior. Los includes de Auth solo verifican su catálogo, propietarios, políticas y permisos.

| Orden | Archivo | Efecto |
|---|---|---|
| 030 | `030-listado-base.sql` | Esquema, cuatro tablas base y tres identidades, bajo `scrum101_owner`. |
| 031 | `031-listado-contract.sql` | Conversión validada de CLP, catálogo, geografía, reglas y ocupación. |
| 032 | `032-listado-images.sql` | Metadatos, índice único parcial, journal y cola de limpieza. |
| 033 | `033-listado-cut.sql` | Seed histórico de 16 regiones y 346 comunas. La comprobación compara huellas del contenido ordenado, incluidos IDs, nombres y pares. |
| 034 | `034-listado-admissions-acl.sql` | Admisión, reservas, capacidad, ACL mínimas y RLS. Comprueba el resultado antes de confirmar. |
| Verificación | `034-listado-verify.sql` | Catálogo, seed, propietarios, permisos efectivos y aislamiento de Auth y Listado en solo lectura. |
| Comportamiento | `tests/listado-behavior.sql` | Opt-in con datos sintéticos, roles efectivos y rollback. Distingue 42501, 23505, 23503 y 23514. Las identidades pueden avanzar aunque las filas se reviertan. |

El manifiesto fija revisión y SHA-256 normalizado a LF de cada fuente. La suite estática verifica las fuentes históricas y la igualdad del seed derivado. Los wrappers tienen una sola transacción y delimitan el cambio de rol al DDL y los permisos propios de Listado. `checks/listado-cut.sql` es un auxiliar compartido por carga, verificador y pruebas. Los runtimes permanecen sin acceso hasta 034 y el servicio necesita el esquema completo para leer publicaciones y postulaciones.

El índice histórico incluye filas con `object_path` presente. PostgreSQL considera distintos los valores NULL por defecto, por lo que dos filas con la misma ruta y `bucket NULL` pueden coexistir. La carga histórica deberá conciliar esos metadatos antes de adoptar un check adicional o cambiar la unicidad. 032 conserva la URL y no mueve archivos. Las relaciones con Auth y Convivencia son lógicas y se concilian fuera del DDL.

Antes de importar datos, decidir cómo preservar fechas, precios sin redondeo, catálogos, IDs, ocupación y reservas, y el tratamiento de eventos y objetos en vuelo. Las pruebas SQL sintéticas no cubren el almacenamiento real, el tráfico HTTP ni la concurrencia entre sesiones. Mantener pendiente el endurecimiento de `PUBLIC` en bases estándar. Ante un error del ensayo, inspeccionar el catálogo en solo lectura antes de decidir cómo continuar.

## Match/Conexión (040–041) · validación técnica cerrada en el ensayo local

040 y 041 se aplicaron y verificaron en el PostgreSQL 17.6 desechable principal. El verificador confirmó propietarios, privilegios efectivos, RLS, integridad de Match y aislamiento respecto de Auth y Listado. Pasaron 21 de 21 casos de comportamiento. Un ensayo adicional confirmó que el runtime no puede insertar explícitamente el estado `Aceptada` (`42501`), que el propietario sí puede hacerlo y que el trigger registra un único par canónico legible por el runtime. Ambos ensayos terminaron con `ROLLBACK`.

Quedan sin validar el backfill sobre aceptaciones históricas preexistentes, las carreras de dos sesiones, los datos históricos reales y el comportamiento HTTP o en Kubero TEST. El laboratorio adicional de concurrencia y backfill de Match es experimental, queda excluido de esta entrega y sigue pendiente de ejecución.

El destino es `private-v1`. Verificar 034, identidad del contenedor, huellas, socket, marca y versión antes de ejecutar. Usar los mismos argumentos de psql y credencial efímera de Auth. Los pasos incluyen guards de 010 y verificadores de Auth y Listado antes de asumir `scrum101_owner`. Cada paso controla una sola transacción. Ante error o desconexión, inspeccionar el catálogo en solo lectura antes de decidir cómo continuar.

| Orden | Archivo | Efecto |
|---|---|---|
| 040 | `040-match-base.sql` | Crea conexión privada, identidad BIGINT, defaults, checks, índice simétrico de pares vigentes y RLS. Los runtimes conservan cero acceso al dominio en esta etapa. |
| 041 | `041-match-history-acl.sql` | Bajo bloqueo de la tabla operativa, crea historial, función y trigger, y registra pares aceptados presentes con `ON CONFLICT DO NOTHING`. Instala y verifica los grants y RLS antes de confirmar. |
| Verificación | `041-match-verify.sql` | Verifica forma, propietarios, índices, trigger, permisos efectivos, cobertura del backfill e integridad de Auth y Listado en solo lectura. |
| Comportamiento | `tests/match-behavior.sql` | Opt-in sintético bajo roles efectivos, con rollback. Verifica defaults, unicidad, bloqueo, aceptación idempotente, permanencia del historial al borrar y errores 42501, 23505 y 23514. Las secuencias pueden avanzar aunque se reviertan las filas. |

El historial registra únicamente el par canónico `(usuario_menor, usuario_mayor)` con ambos IDs positivos y distintos. La matriz SCRUM-101 menciona `primera_aceptacion`, columna ausente en el contrato vigente. Antes del corte, reconciliar esa discrepancia si el contrato futuro exige una fecha y confirmar una fuente autorizada. La fecha de solicitud tiene otra semántica.

Match recibe lectura por columna, inserción de participantes, actualización de estado y borrado solo en `conexion`, más uso del esquema y de su secuencia. El historial es de solo lectura para el runtime. El trigger se instala como `scrum101_owner`, usa `SECURITY DEFINER` con `search_path` fijo y una tabla destino cualificada. La función carece de ejecución directa para `PUBLIC` y el runtime. El propietario escribe el histórico mediante su excepción de RLS, por lo que forzar RLS sobre esa tabla requiere otro diseño. Las reglas por participante se aplican en la API. Los IDs de Auth son referencias lógicas. El historial sobrevive al borrado operativo porque su PK es el par y carece de FK hacia la conexión.

Antes de una carga histórica, conciliar IDs y huérfanos, pares vigentes en ambas direcciones, estados, zona horaria y posición de la identidad. El backfill registra aceptaciones presentes con IDs positivos. Las aceptaciones borradas requieren otra evidencia autorizada. Para probar la ruta de backfill sobre datos previos y la concurrencia entre sesiones, usar un ensayo separado y desechable. El endurecimiento de `PUBLIC` sobre las bases estándar queda pendiente.

## Convivencia/Mensajería (050–052)

Aplican solo el contrato SQL que consume el servicio actual. Tareas, expulsiones, finalización, cambios de capacidad y el conjunto completo de eventos de Sprint 3 v2 siguen fuera de esta serie.

| Paso | Alcance | Verificación independiente |
|---|---|---|
| 050 | Esquema privado, incorporación, arriendo, pertenencia, outbox y trigger de capacidad. | `050-convivencia-verify.sql` |
| 051 | Intervalos y trigger de fin. Inicializa la versión por conteo de **todas** las pertenencias, según 003. Conserva los fines históricos desconocidos. | `051-convivencia-verify.sql` |
| 052 | Conversaciones y mensajes, unicidad por UUID de cliente, índice de paginación y creación de conversaciones faltantes. No actualiza IDs existentes. | `052-convivencia-verify.sql` |

### Inspección de identidad del laboratorio

El equipo aprobó el identificador inicial del clúster principal a partir de una inspección de solo lectura. No había una medición histórica independiente previa. Para una nueva inspección autorizada:

1. Identificar por ID completo `9f469c91d95bfc5f7ef316906e0b2a8c0873d8684b601b59d829def9b1a0332f` el contenedor `scrum101-pg176-15e89e0eaee2` en Docker Desktop local. Comprobar el digest aprobado, la etiqueta del ensayo y el volumen exclusivo `scrum101-pg176-15e89e0eaee2-data` en el directorio de datos. Exigir red `none`, ningún puerto publicado y montaje de propuestas en solo lectura. Excluir el laboratorio adicional de Match.
2. Abrir una sesión por el socket Unix de ese ID, con el mecanismo efímero existente, como `scrum101_admin` en `roomies_scrum101_disposable`. Bajo `BEGIN TRANSACTION READ ONLY` y `ON_ERROR_STOP=1`, comprobar versión `170006`, primario, socket, sesión y comentario `SCRUM-101 disposable private-v1`. Consultar `SELECT system_identifier::text FROM pg_catalog.pg_control_system();` y cerrar con `ROLLBACK`.
3. Cotejar el resultado con cualquier evidencia previa independiente disponible. Si no existe, registrar esa ausencia y presentar la nueva observación vinculada al ID completo, digest, volumen y base para aprobación explícita antes de 050. Detenerse ante cualquier diferencia.
4. En una futura ejecución autorizada, usar el valor ya aprobado con `-v scrum101_system_id=<id registrado>` en 050–052 y en sus tres verificadores. El guard compara ese valor con el catálogo en la misma sesión. La orden de ejecución debe recibir la referencia aprobada como dato de entrada. Queda prohibido obtener un identificador del destino y sustituir la referencia durante la misma ejecución o un reintento.

Cada verificador corresponde al estado inmediatamente posterior a su paso. El verificador de 051 coteja el conteo inicial con los arriendos antes de nuevas escrituras. 052 exige que las tablas de chat aún no existan y hace backfill solo desde los arriendos presentes. Una carga histórica posterior debe preservar los IDs de conversaciones fuente y generar ausencias después de conciliarlos. Las comparaciones de CHECK y predicados usan el texto completo que devuelve el catálogo de PostgreSQL 17.6. Los cuerpos se cotejan con el SQL aprobado recortando solo el espacio exterior. Esto valida la representación esperada, sin certificar equivalencia semántica entre expresiones diferentes.

Los pasos usan una sola transacción, bloqueo de migración compartido con las fases anteriores, ownership bajo `scrum101_owner` y verificaciones de Auth, Listado y Match. 051 y 052 bloquean las tablas fuente durante sus backfills. Los grants históricos se difieren completos a 053. El estado esperado hasta 052 es cero acceso efectivo para los cinco runtimes y `PUBLIC`, con RLS todavía sin configurar.

### 053 · ACL y RLS

| Tabla | Privilegios preparados para el runtime |
|---|---|
| `incorporacion` | SELECT para lecturas, `SELECT *` y `RETURNING`. INSERT de ID y payload. UPDATE de etapa, estado, respuesta HTTP y último intento. Las escrituras efectivas también permiten `FOR UPDATE SKIP LOCKED`. |
| `arriendo` | SELECT requerido por `RETURNING *` y el trigger. INSERT de publicación, capacidad y versión. UPDATE de `version_ocupacion` cubre el bloqueo de fila sin conceder actualización de capacidad ni fecha. |
| `pertenencia` | SELECT para autorización, historial y cupos. INSERT de las cuatro referencias. UPDATE exclusivamente de `estado` para satisfacer la ACL de `FOR SHARE`, con RLS que rechaza escrituras reales. |
| `outbox` | SELECT, INSERT de operación, acción y reserva. UPDATE de reserva, último intento y enviado. El worker requiere `FOR UPDATE SKIP LOCKED`. |
| `conversacion`, `mensaje` | SELECT e INSERT de campos enviados por el servicio. Incluir las columnas leídas por `ON CONFLICT` y devueltas por `RETURNING`. Sin UPDATE ni DELETE. |

PostgreSQL exige UPDATE sobre alguna columna para `FOR SHARE`. En `pertenencia`, la política UPDATE usa `USING (estado = 'Activa') WITH CHECK (false)`. La lectura bloquea la fila activa mediante `USING`. Una actualización real o sin cambios de esa fila debe rechazarse. Las filas inactivas siguen visibles para SELECT ordinario y quedan fuera del bloqueo y del UPDATE. El verificador exige el inventario exacto de políticas permisivas y detecta cualquier política adicional, incluida `ALL`, que pudiera abrir otra vía de escritura.

El runtime mantiene autorización por usuario en la API. Las políticas SELECT de arriendo y pertenencia permiten al trigger invocador contar todos los ocupantes y bloquear su arriendo bajo las políticas SELECT y UPDATE. Se usa RLS sin FORCE, con objetos bajo `scrum101_owner`, sin membresías administrativas, BYPASSRLS ni acceso directo del runtime a secuencias o funciones. El ensayo SQL local verificó la generación interna de identidades con INSERT y RETURNING. Los UPDATE rechazados pueden alcanzar triggers BEFORE y tomar bloqueos antes del rechazo.

`053-convivencia-acl-rls.sql` verifica el estado exacto de 052 antes de habilitar ACL y RLS y usa un verificador específico de 053 antes de confirmar. Para una futura ejecución se exige la misma identidad previamente aprobada mediante `-v scrum101_system_id=<id registrado>`. `053-convivencia-verify.sql` abre una sesión independiente de solo lectura para comprobar el estado posterior. Probar después `tests/convivencia-behavior.sql` en un estado sintético vacío, con ROLLBACK. Las identidades pueden avanzar pese a revertir las filas. Los ensayos de [dos sesiones](tests/convivencia-concurrency.md) necesitan autorización separada y un destino sintético que pueda descartarse. La hipótesis queda bloqueada si el runtime puede actualizar una pertenencia, si falla un bloqueo legítimo o si los ensayos detectan una carrera. La autorización por usuario, la integración HTTP y la compensación remota requieren pruebas aparte.

Los scripts de concurrencia, inventario y limpieza de Convivencia forman parte del material de ensayo de esta entrega. Los casos de dos sesiones siguen sin validación dinámica y quedan fuera de la ejecución automática de migraciones. Usar una base desechable reservada para el ensayo, vacía de datos ajenos. La limpieza exige autorización específica vinculada al inventario validado y al destino exacto.

#### Evidencia estructural para la futura ejecución autorizada

1. Tras validar el contenedor por ID completo, el socket y las huellas, ejecutar el verificador de **052 como precondición**. En otra sesión de solo lectura con la misma identidad, ejecutar `/scrum101/checks/convivencia-structure-snapshot.sql` con `psql -X -qAt -v ON_ERROR_STOP=1 -v scrum101_system_id=<id aprobado> -f ...` dentro del contenedor Linux y con el mecanismo de credenciales existente. Conservar solo stdout como JSON local fuera del repositorio y registrar el código de salida. Un error o una captura incompleta impiden continuar. No capturar datos de negocio.
2. Tras 053, ejecutar primero el verificador independiente de **053**. Repetir la captura con el mismo script, base y versión de PostgreSQL, y conservarla aparte. No ejecutar el verificador histórico de 052 sobre el estado con RLS.
3. Ejecutar `python -B checks/compare_convivencia_structure.py <antes.json> <después.json>` desde este directorio. Exigir salida 0 además del éxito del verificador de 053. La comparación interpreta JSON, por lo que no depende del orden de las claves ni del formato del archivo. Compara definiciones ordenadas y propiedades estructurales del catálogo del mismo clúster, incluidos OID, ownership, identidades, constraints, índices, funciones y triggers. Omite las ACL, el estado y las políticas RLS, que verifica 053 por separado, así como los contadores de filas y secuencias y el estado físico del almacenamiento. Si cambia la representación de una definición del motor, detenerse y examinar los dos registros. No normalizar a ciegas el texto de las definiciones.

El ensayo de comportamiento fija `lc_messages = 'C'` antes de adoptar el runtime. Para un UPDATE de pertenencia activa exige el SQLSTATE de permiso y el diagnóstico completo de nueva fila rechazada por RLS en `pertenencia`. El caso `row_security=off` exige el diagnóstico distinto de consulta afectada por RLS, y verifica después que la configuración y la fila se conservaron. Los diagnósticos se basan en PostgreSQL 17.6 y se comprobaron en el ensayo funcional local.

## Pendientes de cierre

- 070: cerrar la matriz de ACL y RLS por objeto y probar con logins de ensayo. Después se podrán ensayar carga sintética y recuperación aislada. Origen autorizado, reconciliación de identidad y archivos, y corte en Kubero pertenecen a fases posteriores.

Véase [estado de Kubero y coordinación de tickets](../../docs/deployment/kubero.md).

## Reportes 060–062

Las propuestas requieren el estado posterior a 053 y el identificador aprobado mediante `-v scrum101_system_id=<id aprobado>`. Ejecutar y verificar cada etapa en orden con una sesión de catálogo independiente antes de avanzar. Las migraciones usan una transacción, serializan el cambio mediante un bloqueo asesor y conservan los controles de los dominios anteriores. No volver a ejecutar una etapa ya instalada.

- 060 crea el esquema `reportes` y `reporte`, con identidad y los índices de paginación. 010 ya provisiona `sql_reportes` y no crea el esquema.
- 061 agrega historial, cola de avisos e idempotencia, con FK internas e identidad de actuación. Conserva `CHAR(64)` para la huella histórica y deja al servicio el cálculo de SHA-256. No incorpora un CHECK nuevo ni introduce FK hacia otros dominios.
- 062 concede ACL por columna y RLS por operación al runtime. `UPDATE(estado)` y los dos campos actualizables de outbox cubren tanto el DML como los bloqueos de fila. `USAGE` sobre cada secuencia conserva la capacidad prevista de consumir valores y no autoriza reiniciarlos. Los bloqueos asesores del repositorio usan funciones incorporadas y no requieren privilegios adicionales sobre objetos de Reportes.

La autorización del denunciante y del administrador pertenece a HTTP. Las políticas SQL habilitan las filas al servicio dedicado y el repositorio controla transiciones, reintentos y atomicidad. Verificar sobre PostgreSQL 17.6 la representación exacta del catálogo y ejecutar ensayos autorizados de INSERT/RETURNING, revisión, paginación, idempotencia y toma de avisos antes de activar el worker. El ensayo de migración y las verificaciones no invocan entregas HTTP.

Antes de importar, confirmar el origen autorizado, preservar identidades y estados, conciliar IDs embebidos en respuestas y reconciliar las actuaciones pendientes o ya entregadas para evitar duplicados. Probar los contratos externos de identidad, propiedad, relación histórica y notificaciones antes de activar Reportes en Kubero TEST. La concurrencia dinámica de Convivencia sigue pendiente.
