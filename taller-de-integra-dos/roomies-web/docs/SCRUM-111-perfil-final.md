# SCRUM-111: cuenta y perfil con el contrato final

Referencia: contrato Sprint 3 v2 editado, pp. 9–10, y backlog TI2 v1.4, S3R-D01. Proyecto en `taller-de-integra-dos/roomies-web`, igual que main.

## Operaciones

- POST `/api/usuarios/me`: inicialización idempotente desde UUID autenticado; nombre hasta 120 y fecha ISO de mayor de edad. Devuelve el perfil propio y no enlaza por correo.
- GET `/api/usuarios/me`: perfil propio, edad derivada, correo verificado desde identidad, calificación null y cero evaluaciones. Las fechas históricas desconocidas no se inventan.
- PATCH `/api/usuarios/me`: solo campos editables; ausencia conserva y null borra. Enumeraciones de ocupación/género, límites 160/2000 y ubicación contrastada con Listado por HTTP. Un estado concurrentemente modificado exige consultar otra vez antes de escribir los datos de ubicación.
- PUT `/api/usuarios/me/foto`: un campo multipart `foto`, JPEG/PNG/WebP, máximo 5 000 000 bytes y 20 millones de píxeles decodificados. Nueva clave inmutable en `perfiles`; confirma la referencia y encola la retirada de la anterior. Una confirmación SQL incierta no autoriza borrar la posible foto activa. La cola reintenta la limpieza sin retirar archivos locales heredados ni objetos ajenos.

Se conservan las rutas antiguas para clientes en transición. Gateway mantiene no-store, Bearer y boundary. Next selecciona las rutas finales con `WEB_PROFILE_CONTRACT=v1`, sin fallback automático si fallan. BFF admite fotos del bucket perfiles del proyecto configurado y referencias locales heredadas.

## Configuración y SQL

`supabase/migrations/20261123213932_scrum111_perfil_comun.sql` añade `auth_users.perfil_comun` y `auth_users.foto_limpieza`, con RLS y permisos del rol existente `sql_auth_users`. Aplicada al proyecto autorizado el 23/11/2026. No modifica las columnas de `haycupo.usuario`, no crea roles ni cambia los buckets.

Auth usa `ROOMIES_SUPABASE_STORAGE_KEY` solo en el servidor. La clave no va en Git ni en Next. Compose declara el secreto en Auth y el contrato v1 en Next. La configuración privada local se conserva fuera del repositorio.

## Evidencia

- Auth: 147 pruebas aprobadas, dos integraciones opt-in omitidas. Incluye 15 casos nuevos de perfil/foto con dependencias simuladas.
- Gateway: 146 pruebas aprobadas.
- Perfil, sesión, publicaciones, postulaciones y reportes web: 93 pruebas aprobadas.
- Recorrido HTTP con Next/BFF/Gateway/Auth/Listado/Convivencia y PostgreSQL temporal reales: aprobado, incluyendo PATCH, foto/logout/login, rechazo del token revocado, retirada de la foto anterior, aislamiento y admisión de la 112. Identidad y Storage usan proveedores HTTP ficticios explícitos.
- Supabase Storage real: subida de PNG sintético a perfiles, lectura pública con bytes iguales y retirada del objeto temporal, aprobadas. No modifica la foto de una cuenta ni acredita por sí sola el recorrido completo con una cuenta real.

Build aislado, TypeScript, lint y navegador de perfil aprobados. Las pruebas de navegador de ubicación y aceptación también pasaron; se ajustaron expectativas históricas de verificación para contar solo envíos de código y usar el mensaje vigente del Gateway.

No se declara validación de producción ni se cambia Jira a Finalizado. El recorrido real de cuenta y la comprobación publicada se documentan separadamente de estas pruebas.
