# SCRUM-72 — propuesta PostgreSQL V2 para el backend JWT actual

**BORRADOR PARA REVISIÓN. No ejecutar en Supabase.** Se validó en PostgreSQL desechable con datos sintéticos, sin conexión ni cambios en producción. Esta revisión sustituye
el diseño para 21e9ffa por el contrato del backend ya adaptado en esta rama.
Los tipos/restricciones reales no se deducen del Table Editor: deben comprobarse.

## Archivos

1. `01-preflight.sql`: consultas de solo lectura, snapshot REPEATABLE READ.
2. `02-email-verification.sql`: creación inicial, transaccional, con precondiciones.
3. `03-postflight.sql`: comprobaciones de solo lectura, sin mostrar códigos o tokens.
4. `04-recovery.md`: recuperación antes/después de commit y ante resultado incierto.
5. `tests/test_consistency.py` y `tests/requirements.txt`: análisis estático con pglast.

El backend no se cambia en esta etapa. Su ADAPTATION.md es una nota histórica:
la advertencia de que la propuesta vieja no bastaba queda resuelta por esta V2,
pero siguen pendientes la aprobación y el preflight real. Las pruebas PostgreSQL aisladas están documentadas al final.
`AUTH_JWT_ENABLED` sigue desactivado por defecto; ningún script activa el servicio.

## Esquema final propuesto

Se conservan `usuario`, `publicacion`, `imagen_publicacion` y `conexion`, sus IDs,
filas, PK/FK y demás columnas. Solo se añade `usuario.verificado BOOLEAN NOT NULL
DEFAULT false` y un índice único funcional de correo. Este índice usa exactamente
`lower(btrim(correo))`, como buscar_usuario. Excluye NULL/blanco para conservar
perfiles sin correo; no podrán entrar hasta una recuperación aprobada. Duplicados
normalizados provocan aborto, sin eliminar, fusionar ni reasignar cuentas.

### codigo_verificacion

| Columna | Tipo | Regla |
|---|---|---|
| id | BIGINT IDENTITY ALWAYS | PK; generado, omitido por el INSERT del backend |
| id_usuario | tipo entero real de usuario.id_usuario | NOT NULL; FK al mismo usuario |
| codigo_hash | TEXT | NOT NULL; 64 caracteres hex minúsculos de HMAC-SHA256 |
| intentos | INTEGER | NOT NULL DEFAULT 0; CHECK >=0 |
| usado | BOOLEAN | NOT NULL DEFAULT false |
| creado_en | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP; backend lo informa |
| expira_en | TIMESTAMPTZ | NOT NULL, sin default; >creado_en |
| enviado_en | TIMESTAMPTZ | NULL hasta confirmar SMTP; si existe, >=creado_en |

No existe columna `codigo` en texto plano ni secreto HMAC en la base. HMAC no es
cifrado reversible: se calcula y compara en Python usando AUTH_CODE_SECRET. No
se necesita pgcrypto. El código de seis dígitos nunca se inserta en SQL.

Índices:
- PK(id), creada automáticamente por PostgreSQL.
- (id_usuario, usado, creado_en DESC, id DESC): búsqueda/consumo del código.
- (id_usuario, creado_en DESC): historial, cooldown y límite por hora.
- UNIQUE(id_usuario) WHERE usado=false: máximo un pendiente por usuario, incluso
  si está expirado o todavía no tiene enviado_en. El backend consume los anteriores
  bajo lock antes de insertar; no usar now() en el predicado del índice.

Los cinco intentos, 60 segundos y cinco emisiones/hora se controlan en el backend;
no se copia ese estado de configuración a defaults SQL de expiración. Conservar
historial al menos una hora, incluyendo emisiones fallidas, para no evadir límites.
Una verificación incorrecta/expirada se confirma antes de responder el error HTTP.

### sesion_jwt

| Columna | Tipo | Regla |
|---|---|---|
| jti | UUID | PK NOT NULL; lo genera Python, sin default SQL |
| id_usuario | tipo entero real de usuario.id_usuario | NOT NULL; FK al mismo usuario |
| expira_en | TIMESTAMPTZ | NOT NULL, lo deriva Python del exp del JWT |
| revocado | BOOLEAN | NOT NULL DEFAULT false |

Índices: PK(jti), (id_usuario) para la FK y (expira_en) para mantenimiento futuro.
No se almacena el JWT completo. Login inserta antes de devolver token; la dependencia
consulta jti/usuario verificado/expiración/revocación; logout actualiza revocado.
Un token firmado pero sin sesión registrada no basta para acceder.

Ambas FK copian el tipo real SMALLINT/INTEGER/BIGINT sin renumerar usuarios.
ON DELETE CASCADE solo elimina códigos/sesiones cuando posteriormente se elimine
expresamente ese usuario; no toca publicaciones/conexiones ni sus FK existentes.

## Precondiciones y abortos seguros

Requiere PostgreSQL 12+ y tablas existentes ordinarias. Las propuestas nuevas de
tipos son decisiones de diseño; no se presentan como tipos confirmados en Supabase.
Si el ID es dominio/UUID, tabla particionada o solo hay un índice único sin constraint
PK/UNIQUE unicolumna no diferible, se detiene para una revisión específica.

El registro actual omite id_usuario: debe existir generación por identidad/default.
El script comprueba que nombre admita 200 caracteres, correo 254, contraseña 97
(longitud Argon2id actual) y fecha_nacimiento sea DATE. TEXT y VARCHAR de capacidad
suficiente son aceptados; dominios/CITEXT/CHAR y capacidades menores se revisan.
No se altera automáticamente ningún tipo. Otras columnas NOT NULL sin default
omitidas por registro bloquean la migración. No se cambian triggers para sortearlas.

También se detiene ante IDs no positivos, correos duplicados o cualquier objeto JWT
preexistente. **No es un upgrade de una migración V1 aplicada:** si aparece codigo
antiguo o sesiones, no se eliminan ni recrean; se diseña un upgrade separado después
de inspeccionar datos y permisos. No hay IF NOT EXISTS que oculte diferencias.

Revisar además default de IDs y permisos de sus secuencias existentes, constraints,
triggers, collations/normalización Unicode y filtros SQLAlchemy del negocio. Las
consultas previas muestran metadatos y totales, sin passwords/códigos/sesiones.
Los recuentos deben tomarse con un rol inspector autorizado que vea todas las filas;
RLS puede filtrar resultados. Igualdad de recuentos por sí sola no prueba igualdad
de contenido: conservar una copia protegida y comparar los metadatos/snapshots.

## Roles, permisos y RLS

Antes de una futura ejecución autorizada se debe identificar el rol efectivo de
FastAPI, ya existente. Configurar `haycupo.jwt_backend_role` en la misma sesión
inspectora; no es un secreto ni cambia DATABASE_URL. El script no crea roles ni
modifica membresías, passwords o credenciales. Sin rol explícito, aborta.

Se exige un rol dedicado sin superuser/BYPASSRLS ni membresía en roles privilegiados
ni en el propietario de los objetos nuevos; anon/authenticated/authenticator no
pueden asumirlo. No usar postgres/service_role como atajo. Confirmar también todas
las membresías privadas: las políticas de rol pueden aplicar a sus miembros.

El rol debe tener USAGE del esquema y los permisos anteriores del negocio. El
script NO concede permisos nuevos en las cuatro tablas existentes. Si se usa
privilegio por columna en lugar de tabla, preparar revisión específica, no ampliar
permisos indiscriminadamente para superar el chequeo. Si existe RLS, exige auditoría
previa y la confirmación `haycupo.jwt_existing_rls_reviewed=yes`; ese marcador no
cambia ni elude ninguna política.

Códigos y sesiones quedan con RLS habilitado y política jwt_backend_only para ese
rol; SELECT/INSERT/UPDATE, sin DELETE ni GRANT OPTION. La secuencia identity recibe
USAGE. Se retiran grants de PUBLIC y defaults heredados SOLO de esos objetos nuevos.
El propietario/DBA conserva su acceso normal. El rol de mantenimiento requiere una
aprobación separada; no se crean tareas automáticas de purga.

El backend controla el propietario mediante JWT; no se usa auth.uid(), porque no
es Supabase Auth. La política permite al servidor operar sobre las filas de la
aplicación, no entrega acceso directo al cliente. RLS de tablas existentes no se
modifica: el SQL actual debe poder leer/insertar/actualizar las filas necesarias.
El script bloquea acceso cliente directo/heredado a SELECT(contrasena) o
UPDATE(verificado). Revisar también funciones SECURITY DEFINER y exposiciones Data
API; las comprobaciones estáticas no pueden probar sus efectos desplegados.

## Cuentas antiguas

Todos los usuarios existentes quedan no verificados, sin alterar su contraseña,
ID, perfil o relaciones. No se crean códigos/sesiones ni se envían correos. Ninguna
cuenta se acredita simplemente porque ya existía.

- Contraseña sin hash Argon2 válido: login 401, incluso tras confirmar el correo.
- Hash Argon2 válido pero verificado=false: login 403.
- Se requiere restablecimiento acreditado en el MISMO usuario para credenciales
  antiguas. Ese endpoint todavía no existe; decidir con Francisco antes de activar.
- Registro repetido del backend actual no cambia passwords ni otros datos. No usar
  otro registro para recuperar acceso ni añadir una comparación plaintext fallback.
- Correo inexistente, compartido, duplicado o inaccesible: revisión de identidad,
  nunca elección arbitraria de una fila ni cambio automático de correo.

Los prefijos agregados del preflight no demuestran que un hash sea válido. Restringir
acceso a credenciales y backups antiguos hasta aprobar su tratamiento; esta migración
no transforma ni borra datos sensibles ya almacenados.

## Pruebas realizadas y límites

Instalar tests/requirements.txt en el entorno separado. Ejecutar:

```powershell
.\.venv\Scripts\python.exe -I -B migration-proposals/SCRUM-72/tests/test_consistency.py
```

El test borra el entorno heredado y bloquea red. Solo lee fuentes, usa AST Python y
el parser PostgreSQL local pglast 8.7: no importa el backend, no conecta una base y
NO ejecuta SQL, ni siquiera en memoria. Comprueba SQL/PLpgSQL, los DDL dinámicos
para los tres tipos de ID, nombres/tipos/null/defaults, INSERT omitidos, FK,
consistencia con cada execute estático del backend y casos mutados que deben fallar.
También verifica formato HMAC, capacidad Argon2, índices y ausencia de DML sobre
cuentas/tablas existentes. Las inspecciones solo admiten SELECT y configuración de
transacción de lectura. El parser usa gramática PostgreSQL 18; no certifica permisos,
resolución de objetos ni funcionamiento en una versión desplegada concreta.

Antes de producción faltan ensayos PostgreSQL desechables: DDL, rollback, permisos
efectivos/RLS con el rol real propuesto, registro-verificación-login-logout con SMTP
simulado y carreras de reenvío/consumo. No sustituirlos por una prueba en Supabase.

Referencias primarias:

- [RLS de PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Privilegios](https://www.postgresql.org/docs/current/ddl-priv.html)
- [Índices parciales](https://www.postgresql.org/docs/current/indexes-partial.html)
- [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [API pglast](https://pglast.readthedocs.io/en/latest/api.html)

Todas las decisiones de despliegue siguen sujetas a revisión de Francisco y del
responsable de base de datos.


## Validación ejecutada en PostgreSQL desechable (2026-10-24)

Se ejecutaron preflight, migración V2 y postflight en PostgreSQL 18.6, en un clúster temporal independiente del servicio instalado, enlazado solo a 127.0.0.1 con puerto efímero. No se utilizó Supabase ni el .env del proyecto. El clúster fue detenido y eliminado al terminar. Esta validación NO autoriza ejecutar la migración en otros entornos ni confirma el esquema real de producción.

Reproducir en Windows con el Python del entorno de pruebas que ya contiene dependencias backend:

```powershell
.\.venv\Scripts\python.exe -I -B migration-proposals/SCRUM-72/tests/run_disposable.py --pg-bin 'C:/Program Files/PostgreSQL/18/bin'
```

El runner requiere binarios initdb/pg_ctl locales y permisos para crear y detener su propio proceso PostgreSQL. Limpia el entorno heredado antes de importar backend, bloquea dotenv/SMTP y limita psycopg al DSN generado por él. No usa un DSN externo. El usuario del SO que ejecuta las pruebas puede administrar este clúster efímero; el acceso trust solo se utiliza allí con datos sintéticos, nunca es una configuración de despliegue.

Se usan cuatro tablas sintéticas con relaciones: usuario con los campos de perfil conocidos y ID bigint identity; las otras tres contienen solo las columnas necesarias para verificar conservación de relaciones y contar publicaciones. No se pretende reproducir todo el esquema de publicaciones ni probar su CRUD completo. No se ejecuta el lifespan de FastAPI para evitar inicialización de imágenes o requisitos de columnas ajenos al escenario.

Resultado: **48 comprobaciones aprobadas**, incluyendo ejecución real del DDL, conservación de IDs/datos/relaciones sintéticos, abortar duplicados normalizados sin DDL parcial, rechazo de reaplicación, FKs, checks, secuencias, RLS y permisos con rol backend no privilegiado y rol cliente; registro/login/verificación/revocación con SQL backend real; consumo persistente de intentos, rollback de registro por fallo SQL, registro concurrente, contraseña intacta tras registro repetido y fallo SMTP simulado. También permanecen las 11 pruebas estáticas y las 61 del backend con dobles.

Pendiente antes del despliegue: inspeccionar esquema/ACL/RLS reales mediante preflight autorizado, probar las variantes reales de tipos/constraints y carga del proyecto, políticas existentes, aislamiento/red del proveedor y SMTP capturado en un entorno de integración. PostgreSQL 18 probado no equivale a probar todas las versiones admitidas. Ningún dato ni contraseña real fue usado o modificado.
