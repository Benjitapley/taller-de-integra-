# SCRUM-72 — adaptación JWT de 21e9ffa

Preparación para revisión; producción permanece desactivada. La migración V2 y el flujo conjunto Next.js/FastAPI/PostgreSQL/SMTP STARTTLS se probaron exclusivamente en un entorno local desechable. No se consultó Supabase ni se enviaron correos externos. Véase `../../tests/e2e/RESULTS.md`.

## Activación y dependencias

`AUTH_JWT_ENABLED` ausente o `false` deshabilita autenticación y acceso privado
con HTTP 503. No se conserva el mecanismo inseguro anterior mientras está apagado.
No desplegar esta adaptación como sustitución operativa hasta coordinar clientes,
esquema, credenciales de servicio y medidas adicionales descritas abajo.

Para habilitar en un entorno autorizado: `AUTH_JWT_ENABLED=true`, secretos
independientes `JWT_SECRET_KEY` y `AUTH_CODE_SECRET` de al menos 32 bytes, generados
criptográficamente, y `DATABASE_URL` del servidor. No se generan ni modifican
credenciales existentes. Configuración incompleta falla al arrancar; requests
que no pasen por lifespan fallan con 503. No hay secreto de respaldo. HS256 es el
único algoritmo admitido; cambiarlo requiere un diseño de claves específico.

`JWT_EXPIRATION_MINUTES`: 1..60, default 15; `CODIGO_EXPIRACION_MINUTOS`: 1..30,
default 15. Se exigen firma, exp, iat, sub positivo canónico, iss, aud y jti UUID.
El JWT no lleva nombre ni correo. Emisor `haycupo-api`, audiencia `haycupo-clients`.
FastAPI consulta usuario verificado y sesión activa en cada petición privada.
No hay refresh. Logout revoca solo la sesión presentada; requests ya en curso
pueden terminar. Para múltiples procesos, compartir la misma configuración.
Los JWT antiguos de Francisco sin esos claims y sin sesión registrada se rechazan;
se requerirá un nuevo login. El helper interno create_access_token ahora recibe
user_id y devuelve (token, claims) para registrar jti antes de responder. No copiar
llamadas antiguas con data={...} sin adaptarlas.

SMTP usa `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, STARTTLS
con validación de certificado y timeout. No se cargan .env al importar los módulos
de auth; el entrypoint principal conserva su carga existente para ejecución normal.
No añadir claves de BD o SMTP a Next.js ni a logs.

Instalar dependencias de ejecución con `backend/auth_service/requirements-jwt.txt`
(extiende el requirements anterior, sin sobrescribirlo). Argon2id, contratos y
flujo de Francisco se adaptaron; se usa PyJWT ya declarado en esta rama en lugar
de añadir además python-jose. Fernet no participa en este flujo y no se copió.

## Cambios API para coordinar ANTES de habilitar

Las URL y los JSON de entrada/salida satisfactoria de registro, verificar,
reenviar y login se conservan. Login devuelve JWT Bearer al consumidor de servidor;
el BFF de Next.js lo guarda en cookie HttpOnly y no lo devuelve al browser. Su activación por defecto sigue deshabilitada; no se emiten cookies desde FastAPI. El proxy web antiguo `/auth/*` devuelve 410 y no llega a este contrato servidor-servidor.

- Registro repetido de cuenta no verificada solo reenvía, sujeto a límites. Nunca
  cambia password, nombre, fecha o correo. Usa el nombre/correo de la fila existente.
- Código inválido en formato: 422 (seis dígitos ASCII exactos). Intentos erróneos:
  400; el quinto bloquea y devuelve 429. Un código consumido ya no puede usarse.
- Reenvío/registro repetido: 429 y Retry-After con cooldown de 60 segundos y máximo
  de 5 emisiones por usuario/hora. Fallos de envío también cuentan contra el límite.
- Fallo SMTP: 503, sin afirmar envío; la cuenta nueva queda no verificada. La
  recuperación es solicitar otro código tras cooldown, sin reescribir credenciales.
- Fallos de BD/configuración: 503 genérico en auth; no se exponen excepciones SQL.
- Logout exige Bearer válido y revoca jti en BD. Ausencia, expiración o repetición
  de logout de la misma sesión: 401. Sustituye el éxito ficticio de 21e9ffa.
- Todo endpoint privado exige Bearer. La cookie roomies_id, user_id de localStorage
  y tokens demo no acreditan identidad. Token ausente/inválido/revocado: 401.
- Publicaciones propias: consultar el detalle del editor, editar o eliminar otra publicación devuelve 404. El detalle exige Bearer (401 anónimo), filtro de propietario y no-store. El catálogo de descubrimiento conserva su acceso público. Se valida
  propietario antes de eliminar imágenes. Perfil inexistente conserva su 404.
- Conexiones: solicitante debe coincidir con JWT; solo destinatario puede responder
  y consultar sus recibidas. Conflicto de identidad: 403. Se conservan campos JSON.
  Las búsquedas de usuarios/publicaciones conservan su acceso público anterior.
- CORS acepta la lista WEB_ORIGINS (separada por comas; defaults localhost:3000 y
  127.0.0.1:3000), sin wildcard ni credenciales. Los clientes Bearer nativos no
  dependen de CORS; otros orígenes web requieren configuración coordinada con C.
- Los 422 conservan detail/loc/msg/type pero omiten input y ctx sensibles. Respuestas
  de autenticación y datos privados llevan Cache-Control: no-store.

No cambian rutas HTML, assets, imágenes, filtros ni cuerpos FormData existentes.
Los consumidores HTML viejos necesitarán un puente de servidor que añada Bearer;
no funcionarán de forma autenticada solo por conservar sus archivos. No degradar
seguridad para mantener roomies_id. Coordinar también móviles, B (publicaciones),
FL (conexiones) y los tipos de errores 429/503 de Next.js en la integración futura.

Se eliminó create_all al importar modelos. SQLAlchemy se inicializa al pedir
sesión y apunta explícitamente a haycupo. Se conservan aliases de respuesta
id_usuario_PK/id_publicacion_PK/mascotas y se mapean a id_usuario/id_publicacion/
mascota usados por el SQL actual. Confirmar tipos y nombres de conexion (incluidas
mayúsculas) en preflight: no se comprobó el esquema desplegado desde aquí.

## Esquema requerido: propuesta SQL V2

NO ejecutar migration-proposals/SCRUM-72/02-email-verification.sql en Supabase sin aprobación y preflight real. La V2 ya coincide con este backend y se ejecutó en PostgreSQL desechable; la nota sobre la propuesta vieja corresponde a la etapa anterior. El lifespan comprueba columnas sin crearlas.

1. `haycupo.usuario.verificado BOOLEAN NOT NULL DEFAULT FALSE`. Conservar IDs,
   perfiles y relaciones. La columna de password debe admitir hashes Argon2 completos.
2. `haycupo.codigo_verificacion`: `id` PK generada, `id_usuario` FK del tipo real,
   `codigo_hash TEXT NOT NULL` (64 caracteres hex de HMAC-SHA256), `intentos INTEGER
   NOT NULL DEFAULT 0` con CHECK >=0, `usado BOOLEAN NOT NULL DEFAULT FALSE`,
   `creado_en TIMESTAMPTZ NOT NULL`, `expira_en TIMESTAMPTZ NOT NULL` y `enviado_en
   TIMESTAMPTZ NULL`. CHECK expira_en > creado_en. El diseño nuevo NO debe exigir
   la columna codigo en texto plano ni su CHECK de seis dígitos de la propuesta vieja.
3. Índice de código por (id_usuario, usado, creado_en DESC, id DESC), índice por
   (id_usuario, creado_en DESC) para límites y unicidad parcial recomendada sobre
   id_usuario WHERE usado=FALSE como respaldo a la serialización por fila.
4. `haycupo.sesion_jwt`: `jti UUID PRIMARY KEY`, `id_usuario` FK del tipo real,
   `expira_en TIMESTAMPTZ NOT NULL`, `revocado BOOLEAN NOT NULL DEFAULT FALSE`.
   Índice por id_usuario para la FK y por expira_en para mantenimiento.
5. Resolver duplicados de correo antes de una unicidad funcional sobre
   lower(btrim(correo)). El backend normaliza a minúsculas y rechaza múltiples filas
   con 409; usa advisory lock para altas propias, que no protege escritores ajenos.
6. Aprobar RLS/grants de las tablas nuevas para el rol de servidor y secuencias.
   No conceder acceso de cliente a códigos, passwords, flags o sesiones.

Los códigos se generan con secrets, se ligan al ID y se guardan solo como HMAC
con pepper separado. La comparación es constante. La fila de usuario serializa
emisión/verificación; el código también se bloquea al consumir. Commit previo a
SMTP: no se mantiene un lock durante la red. enviado_en se confirma después;
sin ese marcador no puede verificarse. Si SMTP falla se consume el código. Si
SMTP entregó pero falla la confirmación final en BD, queda inutilizable y se pide
reenvío. No hay garantía de entrega exactamente una vez ni outbox duradero.

Los intentos, expiración y bloqueo se confirman ANTES de lanzar el error HTTP;
no se revierten por rollback. Mantener el historial de emisiones al menos una
hora aunque códigos hayan expirado, para no evadir el límite al purgarlos.
Se pueden retirar sesiones expiradas/revocadas mediante mantenimiento autorizado.

## Cuentas antiguas y riesgos pendientes

Nunca se acepta plaintext ni se migra su password automáticamente. Un correo
confirmado con password antiguo seguirá sin poder entrar: requiere un flujo de
restablecimiento acreditado, fuera de esta etapa. No crear otro usuario para
recuperarlo ni cambiar su ID. La rama anterior debe retirarse del acceso de red
antes de una eventual activación; estos cambios no corrigen otro servicio antiguo
que continúe corriendo con credenciales de DB.

Antes de producción: aprobar esquema/permisos, migración de cuentas, rotación y
distribución de secretos, HTTPS/BFF HttpOnly y protección CSRF, rate limiting
distribuido por IP para login/altas/verificación (el límite implementado es por
cuenta/código), política de enumeración (se conservan 404/409/403 del contrato),
reintentos SMTP/outbox y observabilidad sin PII. El upload de perfil heredado
conserva su validación anterior y requiere endurecimiento específico. Esta
adaptación no se declara lista para producción.

## Pruebas y aislamiento

Crear un entorno separado e instalar backend/tests/requirements.txt. Ejecutar:

```powershell
.\.venv\Scripts\python.exe -I -B backend/tests/run_isolated.py
```

El runner elimina el entorno heredado, crea secretos efímeros solo de prueba,
desactiva carga de dotenv/plugins y bloquea psycopg, create_engine, SMTP y red.
Windows permite únicamente el socketpair interno de asyncio, en su hilo y hacia
loopback; PostgreSQL/SMTP siguen bloqueados incluso en localhost. Cualquier intento
de I/O prohibido hace fallar la suite aunque el código capture su excepción.
No se ejecuta lifespan. Los datos y transacciones son dobles en memoria, el SMTP
es simulado; no se crean cuentas, códigos o publicaciones reales. No usar pytest
directamente, que no garantiza ese aislamiento.

Cobertura: contratos felices, registro repetido sin cambio de password, plaintext
rechazado, hashes, firma/algoritmo/claims/expiración, revocación, códigos inválidos,
caducidad, límites, commit/rollback, fallos SMTP, permisos y regresiones de rutas.
Los mocks no acreditan DDL, RLS, locks, carreras o entrega real. No se ejecutó una
base PostgreSQL desechable en la etapa inicial de esta adaptación. Esa limitación quedó resuelta posteriormente por los runners de migración y `tests/e2e/`: prueban PostgreSQL y HTTP reales con datos sintéticos, sin Supabase.


## Cambios encontrados por la prueba integral

La consulta de detalle usada por el editor ahora está restringida al propietario. Coordinar su Bearer y 401/404 con publicaciones; no cambiar el catálogo público sin acordarlo. Los clientes HTML de autenticación deben migrar al BFF HttpOnly: Next ya no publica el JWT del contrato FastAPI mediante rewrites. Producción no se habilita con los lanzadores de pruebas y sus controles no se montan en la aplicación.
