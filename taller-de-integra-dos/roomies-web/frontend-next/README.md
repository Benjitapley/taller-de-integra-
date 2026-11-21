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
