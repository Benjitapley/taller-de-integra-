# SCRUM-101 · Preflight y provisionamiento de PostgreSQL 17.6

Esta carpeta contiene los pasos 000–010 del ensayo `private-v1` y los pasos 020–022 de Auth/Users. El provisionamiento produce una base desechable vacía, con un propietario de objetos y cinco logins sin credenciales iniciales. Auth/Users instala su esquema y permisos sobre esa base provisionada. El contrato de tablas y datos está en la [matriz de migración](../../docs/deployment/scrum-101-matriz-migracion.md).

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

## Pendientes para 030–070

- 030–041: definir tablas base de Listado y Match y encadenar sus ampliaciones, catálogos, índices y triggers históricos. Acordar tratamiento de precios, ocupación, fechas e historial.
- 050–062: incorporar las series de Convivencia y Reportes, conservando su orden y dependencias. Resolver si se aplica RLS adicional en Convivencia.
- 070: cerrar la matriz de ACL y RLS por objeto y probar con logins de ensayo. Después se podrán ensayar carga sintética y recuperación aislada. Origen autorizado, reconciliación de identidad y archivos, y corte en Kubero pertenecen a fases posteriores.

Véase [estado de Kubero y coordinación de tickets](../../docs/deployment/kubero.md).
