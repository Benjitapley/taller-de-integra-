# SCRUM-101 · Preflight y provisionamiento de PostgreSQL 17.6

Esta carpeta implementa los pasos 000–010 del ensayo `private-v1`. El resultado esperado es una base desechable vacía, con un rol propietario de objetos y cinco logins sin credenciales iniciales. El contrato de tablas y datos está en la [matriz de migración](../../docs/deployment/scrum-101-matriz-migracion.md). La fase termina antes del primer esquema de negocio.

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

## Pendientes para 020–070

- 020–022: elegir DDL base de Auth, conciliar `edad`, `presupuesto` y `zona_interes`, añadir las tablas auxiliares y la variante privada de SCRUM-111. Confirmar rutas y adaptador efectivo con SCRUM-102.
- 030–041: definir tablas base de Listado y Match y encadenar sus ampliaciones, catálogos, índices y triggers históricos. Acordar tratamiento de precios, ocupación, fechas e historial.
- 050–062: incorporar las series de Convivencia y Reportes, conservando su orden y dependencias. Resolver si se aplica RLS adicional en Convivencia.
- 070: cerrar la matriz de ACL y RLS por objeto y probar con logins de ensayo. Después se podrán ensayar carga sintética y recuperación aislada. Origen autorizado, reconciliación de identidad y archivos, y corte en Kubero pertenecen a fases posteriores.

Véase [estado de Kubero y coordinación de tickets](../../docs/deployment/kubero.md).
