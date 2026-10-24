# ¿Hay cupo? — frontend Next.js

Base de SCRUM-66: TypeScript, App Router, componentes WEB compartidos y convivencia
con FastAPI. La autenticación real pertenece a SCRUM-72, coordinada con F.
No hay autenticación simulada ni acceso directo desde Next.js a PostgreSQL.

## Ejecución en VS Code

Requisitos: Node.js 20.9 o posterior y npm. Entorno comprobado: Node.js 24.15.0.
Desde la raíz del repositorio, en una terminal PowerShell:

```powershell
cd frontend-next
npm ci
npm run dev -- --port 3000
```

Omitir `npm ci` si ya están instaladas las dependencias del archivo de bloqueo.
Abrir http://localhost:3000. Detener con Ctrl+C.

En otra terminal, desde la raíz del repositorio, solo con un entorno backend
configurado y autorizado:

```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main.main:app --reload --host 127.0.0.1 --port 8000
```

El entorno Python necesita las dependencias existentes. No se modificaron sus
requirements: el archivo principal está vacío y el de auth no declara todos
los paquetes importados. El backend necesita su propia `DATABASE_URL`; Geoapify
utiliza `GEOAPIFY_API_KEY`. No copiar estas variables a Next.js.

**Atención al arrancar FastAPI:** un módulo ejecuta `Base.metadata.create_all`
al importar y el lifespan consulta PostgreSQL. No iniciarlo contra una base real
para una prueba que prohíba escrituras.

Next.js usa `FASTAPI_ORIGIN=http://127.0.0.1:8000` por defecto. Para personalizarlo,
crear `frontend-next/.env.local` a partir de `.env.example`, sin sobrescribir un
archivo existente. Es una variable exclusiva del servidor, sin `NEXT_PUBLIC_`.
No usar credenciales, rutas, query o fragmento en el origen ni apuntarlo a Next.js.
Reiniciar desarrollo tras cambiarla; en producción los rewrites se generan al
compilar, por lo que se debe volver a compilar y reiniciar.

## Rutas actuales y flujo preparado

| URL en el puerto 3000 | Responsable actual |
| --- | --- |
| `/` | Acceso estructural de Next.js: sin Sidebar, formulario ni sesión |
| `/inicio` | Inicio React con Sidebar y pestaña Arriendos |
| `/inicio?vista=personas` | Inicio React, pestaña Personas |
| `/publicar` | Selector visual existente; formularios pendientes |
| `/navegacion` | Guía de revisión, ejemplo de modal y accesos al HTML antiguo |
| `/acceso`, `/legacy/acceso` | Login/registro HTML original, FastAPI `/` |
| `/legacy/inicio` | Inicio HTML original, FastAPI `/inicio` |
| `/crear`, `/legacy/crear` | FastAPI `/crear` |
| `/perfil`, `/legacy/perfil` | FastAPI `/perfil` |
| `/mis-publicaciones`, `/legacy/mis-publicaciones` | FastAPI `/mis-publicaciones` |
| `/editar-publicacion?id=…`, `/legacy/editar-publicacion?id=…` | FastAPI `/editar-publicacion?id=…` |

El flujo preparado es acceso → login/registro futuro → `/inicio` → funcionalidades.
**No está protegido por sesión:** se puede abrir `/inicio` directamente.
Los grupos `(auth)` y `(app)` solo separan layouts y no aparecen en las URL.

El acceso HTML se conserva para compatibilidad y se identifica como sistema
anterior con limitaciones de seguridad. Su redirección de login a `/inicio`
ahora abre React. Los HTML conservan sus enlaces absolutos: `/legacy/*` permite
abrir las páginas originales, pero no aísla todos sus recorridos internos.
Su logout sigue borrando localStorage sin llamar a `/auth/logout`, y vuelve a
`/`, ahora la pantalla de acceso estructural.

Los enlaces HTML cargan documentos completos mediante `<a>`. Entre rutas React
se utiliza `next/link`. No hay un rewrite global de `/legacy/*`: los aliases
son explícitos y una ruta desconocida devuelve 404.

## Organización de código

```text
src/
├── app/
│   ├── layout.tsx                   # HTML, idioma, metadatos y estilos globales
│   ├── globals.css
│   ├── (auth)/
│   │   ├── layout.tsx               # Acceso, sin AppShell
│   │   └── page.tsx                 # /
│   └── (app)/
│       ├── layout.tsx               # AppShell; no autentica ni autoriza
│       ├── inicio/page.tsx
│       ├── publicar/page.tsx
│       └── navegacion/page.tsx
├── components/
│   ├── layout/                      # Header, Sidebar, AppShell, navegación,
│   │                                # UserMenu, PageHeader y PromoCard
│   └── ui/                          # Icon, Button, Card, EmptyState, Tabs, Modal
├── features/
│   ├── auth/                        # AccessPlaceholder y estilos de acceso
│   ├── inicio/                      # HomeContent y estilos del Inicio WEB
│   ├── publicaciones/               # PublicationTypeCard y estilos; entrega a G
│   └── navegacion/                   # ModalDemo y estilos de la guía
├── config/navigation.ts             # Destinos y estados React/HTML/pendiente
└── lib/api/client.ts                # Transporte HTTP compartido
```

Las páginas componen los elementos de cada dominio. Se conservaron los componentes
y el diseño; se trasladaron sus archivos e imports. Los estilos específicos de
Inicio, Publicar, sus tarjetas y la guía están separados para reducir conflictos.

Archivos de soporte: `next.config.ts` (rewrites), `tsconfig.json` (TypeScript
estricto y alias `@/*`), `eslint.config.mjs`, `package.json`, `package-lock.json`,
`.gitignore` y `.env.example`. `next-env.d.ts` y `.next/` son generados e
ignorados. `AGENTS.md` contiene instrucciones generadas por Next.js.
Los ocho WebP originales y los SVG de ejemplo siguen en `public/`.

## Contratos con FastAPI conservados

- `/api/:path*` y `/auth/:path*`: proxy sin cambiar los contratos.
- `/imagenes/:path*`: archivos servidos por FastAPI.
- `/static_creacion/:path*`, `/static_principal/:path*` y `/PerfilU/:path*`:
  recursos originales; conservar mayúsculas y paréntesis.
- `/Iconos/:path*`: prioridad para archivos locales; restantes, como
  `sidebar.css`, hacia FastAPI.
- `/conexiones` y `/conexiones/`: upstream `/conexiones/`;
  las rutas anidadas conservan su recorrido.
- `skipTrailingSlashRedirect` evita redirecciones opuestas con FastAPI.
- Las páginas HTML utilizan `fallback`. `/inicio` se retiró del fallback antiguo
  y tiene alias explícito; los demás destinos originales se mantienen.
- Documentación del backend: http://127.0.0.1:8000/docs directamente.

Endpoints actuales: registro/login con JSON; publicaciones y perfil con
`FormData`; ubicaciones con query `texto`; conexiones y búsquedas según los
contratos existentes. No se modificó ningún endpoint.

`apiRequest<T>` está destinado a futuras llamadas desde el navegador con rutas
relativas de `/api/`, `/auth/` y `/conexiones/`. Usa `credentials: same-origin`,
`cache: no-store`, devuelve `undefined` con cuerpo vacío/204 y conserva errores
en `ApiError.status` y `ApiError.payload`, incluidos los detail de validación.
Para JSON, indicar Content-Type y JSON.stringify; para FormData no fijar
Content-Type, para conservar el boundary. Los genéricos no validan el JSON.

Este cliente no valida sesión y no debe emplearse directamente desde Server
Components: allí harán falta URL absoluta y reenvío explícito de cookies,
sin compartir caché de datos personales.

## Seguridad y alcance

El proxy transmite Cookie al upstream y devuelve múltiples Set-Cookie. No
reescribe sus atributos Domain/Path ni cabeceras Location absolutas.
La cookie actual `roomies_id` tiene HttpOnly y Path=/, sin Domain ni Secure,
con SameSite=lax predeterminado de Starlette. Su presencia no acredita identidad.
El backend acepta un identificador sin firma e incluso usa el usuario 1 si falta.
`demo_cookie_token` tampoco acredita identidad.

No se añadió middleware, guard, proveedor de sesión ni redirección basada en
cookies/localStorage. Cambiar localhost por 127.0.0.1 cambia el host de las
cookies; usar un origen consistente. El proxy del mismo origen no corrige el
CORS actual del backend, que combina wildcard y credenciales.

## Reparto y siguientes tareas

| Responsable | Alcance |
| --- | --- |
| GR — SCRUM-66 | Inicialización, estructura WEB, layouts, navegación y compatibilidad |
| GR — SCRUM-72, con F | Conectar registro, login, sesión y perfil |
| GR — SCRUM-78, con F | Edición de perfil y solicitud de verificación |
| GR — Semana 4 | Panel administrativo y pruebas de integración |
| B | Backend de publicaciones |
| G | Frontend de publicaciones, filtros, creación y gestión |
| FL | Postulaciones y Match |
| F | Seguridad, Supabase Auth, JWT y verificación |
| C | Arquitectura, Gateway y despliegue |

Antes de integrar en dev-web, acordar las URL nuevas y los contratos de sesión.
Después de incorporar esta base, actualizar las ramas de trabajo y desarrollar
por dominio. Coordinar cambios en layouts, navegación, estilos globales,
configuración y archivo de bloqueo; evitar reorganizaciones o reformateos masivos
en paralelo. Las futuras páginas de perfil, registro y administración no se
crearon como placeholders que pudieran interceptar HTML o aparentar funciones.

## Diseño y accesibilidad

Se conserva la referencia WEB oficial: Roomies en la marca lateral, sidebar
blanca de 226 px, paleta #563bdd / #f0ebff / #fcfbff y bordes #e9e5f3.
Inter usa Segoe UI/Arial como respaldo; no hay descargas de fuentes en build.
La columna complementaria se apila por debajo de 1280 px; debajo de 1024 px
se usa el menú desplegable. No se desarrolla una aplicación móvil.

Se mantienen pestañas con flechas/Home/End, aria-selected y selección en URL;
enlace para saltar al contenido; foco visible; diálogos con cierre, ciclo del
foco, Escape y restauración. Las funciones pendientes están identificadas y
sus acciones de negocio deshabilitadas. No se consultan ni inventan datos.

## Comprobaciones

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:api
npm run test:proxy
```

Para probar la compilación: `npm start` después de detener el servidor de
desarrollo del puerto 3000. ESLint se ejecuta separado del build.

- Lint, typecheck y build comprueban la estructura reorganizada.
- test:api: seis casos en memoria, sin red ni base de datos.
- test:proxy: siete casos HTTP más el contenedor de Node. Next.js usa 3000 y un
  upstream aislado usa un puerto libre. Se comprueban React, aliases HTML,
  recursos, parámetros, cookies sintéticas, estados 401/422, rutas desconocidas
  y ausencia de Sidebar/formulario operativo en el acceso.
- La fixture lee los archivos HTML originales sin ejecutarlos. No inicia FastAPI,
  no usa credenciales, no emite roomies_id y no abre conexiones a PostgreSQL.
- Las carpetas .proxy-test-* son temporales e ignoradas; no copian .env y se
  limpian junto con sus procesos. En Windows el entorno restringido puede impedir
  terminar procesos; ejecutar con la autorización correspondiente.
- Tras mover rutas, puede quedar un validator de desarrollo obsoleto en
  .next/dev/types. Detener el servidor de desarrollo y regenerar los tipos;
  no cambiar tsconfig ni excluir errores reales para ocultarlo.

Quedan pendientes la validación con FastAPI real y las pruebas de autenticación,
CRUD, roles y base de datos en un entorno autorizado. Las pruebas aisladas
no garantizan esos flujos. backend/, frontend/, docs/ y la base de datos no se
modifican en esta tarea.
