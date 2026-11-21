# ¿Hay cupo? — frontend Next.js

Next.js sirve las pantallas de Roomies. Las operaciones privadas pasan por los
adaptadores de servidor de Next.js hacia el Gateway y los servicios FastAPI.
La sesión web usa cookies HttpOnly. Supabase Auth gestiona registro, correo y sesión.

## Desarrollo

Desde el directorio de Roomies Web, preparar el Gateway y sus servicios mediante
`docker-compose.local.yml`. Su configuración de identidad y base local se define
en el Compose. Para ejecutar Next.js fuera de Docker:

```powershell
cd frontend-next
npm ci
npm run dev -- --port 3000
```

Usar `.env.example` como referencia para configurar `.env.local`.
`FASTAPI_ORIGIN` y `WEB_AUTH_FASTAPI_ORIGIN` apuntan al Gateway. Si se usa el
Compose, el Gateway expuesto en el host escucha en el puerto 8010.
`WEB_AUTH_ORIGIN` debe coincidir con el origen público exacto de Next.js.
Las variables de autenticación y de transporte pertenecen al servidor.

### Cuenta y perfil · SCRUM-111

Para probar el contrato común, configurar `WEB_AUTH_PROVIDER=supabase` y
`WEB_PROFILE_CONTRACT=v1` en el servidor de Next.js. El Gateway debe publicar
`GET/POST/PATCH /api/usuarios/me` y `PUT /api/usuarios/me/foto` (contrato de
microservicios v1.0, secciones 2 y 3.2, y backlog TI2 v1.4, sección 13).
La sesión se conserva en cookies HttpOnly. El BFF envía al Gateway el token de
Supabase y mantiene separadas la edición de datos y la subida de foto.
El Gateway también sirve las rutas públicas del catálogo geográfico
`/api/regiones` y `/api/regiones/{id}/comunas`.

Usar `npm run test:supabase-auth` y `npm run test:profile` para probar el
adaptador con respuestas de prueba. Una vez disponible SCRUM-94, validar en
el entorno compartido el registro, la confirmación, el cambio entre cuentas
y el reemplazo de foto tras cerrar y reabrir sesión. Hasta entonces, la
configuración existente de desarrollo sigue usando su contrato local.

La integración con SCRUM-94 usa por defecto `WEB_PROFILE_CONTRACT=existing`.
Consulta y guarda en `/api/v1/perfil` y crea el perfil en
`/api/v1/perfil/inicializacion`. Esta transición acepta el DTO publicado por
Valderrama y conserva sus campos y límites. La edad siempre se consulta como
dato de solo lectura. Si Listado no responde, el perfil sigue disponible sin
inventar un total de publicaciones.

Para un despliegue anterior que solo publica `/local/v1/perfil`, configurar
`WEB_PROFILE_CONTRACT=local-v1`. La inicialización y la consulta usan ese mismo
prefijo. Seleccionar la versión según las rutas publicadas por el servicio;
no se reintenta automáticamente contra otra ruta ante una credencial rechazada.

La ruta separada de fotografía y Supabase Storage del contrato v2 permanecen
condicionadas a su publicación en Auth/Users y Gateway. En la transición,
la foto viaja en el formulario multipart a Auth/Users y conserva el
almacenamiento configurado por ese servicio. Para acreditar Storage, repetir
la prueba con el modo v1 y comprobar la foto en otra sesión y después del
redeploy. Las pruebas con archivos temporales locales solo acreditan la carga
en el contrato de transición.

`npm run test:profile-http` ejecuta el BFF contra el router FastAPI de SCRUM-94
en localhost, con identidad y repositorio de perfiles de prueba y archivos
temporales. Comprueba edición, carga y lectura de imagen, aislamiento entre
dos cuentas y conservación de la foto anterior tras rechazar un archivo.
En Windows utiliza `.venv/Scripts/python.exe` del repositorio. Se puede
seleccionar otro intérprete con `ROOMIES_TEST_PYTHON`; debe tener instaladas
las dependencias de Auth/Users. Esta prueba no verifica Supabase Cloud,
PostgreSQL ni la durabilidad del almacenamiento de producción.

## Rutas

| Ruta | Función |
| --- | --- |
| `/`, `/registro`, `/verificar` | Acceso, registro y confirmación de correo |
| `/recuperar-contrasena`, `/restablecer-contrasena` | Recuperación de contraseña |
| `/inicio`, `/inicio?vista=personas` | Descubrir arriendos y personas |
| `/publicar`, `/publicaciones/{id}` | Crear y consultar un aviso |
| `/mis-publicaciones`, `/editar-publicacion?id=…` | Gestionar avisos propios |
| `/postulantes/{id}`, `/mis-postulaciones` | Gestionar postulaciones |
| `/perfil`, `/mis-conexiones`, `/admin` | Perfil, conexiones y administración de consulta |

`/crear` redirige a `/publicar`. Las páginas privadas comparten la validación de
sesión de `(app)/layout.tsx`. Para autenticación desde el navegador se usa
`/web-api/auth/*`. Los rewrites de datos e imágenes siguen en `next.config.ts`.

## Organización y comprobaciones

- `src/app/` contiene rutas, layouts y los handlers `web-api`.
- `src/features/` contiene las pantallas y estados de cada área.
- `src/components/` contiene los componentes compartidos.
- `src/lib/` contiene los adaptadores de servidor y el transporte HTTP.

Ejecutar `npm run lint`, `npm run typecheck`, `npm run build` y
`npm run test:proxy`. El último comando levanta Next.js y un upstream HTTP de
prueba para comprobar la sesión, las rutas activas y el proxy.

Para revisar el recorrido principal, consultar la
[guía de QA](../docs/endpoint/manual-testing-auth-publicaciones.md).
Las [pruebas históricas](../tests/e2e/README.md) documentan el entorno aislado
de FastAPI y PostgreSQL usado en Sprint 2.
