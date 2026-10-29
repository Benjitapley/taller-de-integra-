# ¿Hay cupo? — frontend Next.js

Base de SCRUM-66: TypeScript, App Router, componentes compartidos y convivencia con FastAPI. SCRUM-72 añade formularios de login, registro y verificación con validación local y transporte de servidor bajo `/web-api/auth/`.

La integración permanece desactivada por defecto. Requiere habilitación explícita de un entorno aislado; si el backend no responde, devuelve un error y no simula éxito. Next.js no accede directamente a PostgreSQL. El JWT se conserva en cookie HttpOnly y nunca en localStorage ni en JSON enviado al navegador. Los detalles de configuración y límites están en «SCRUM-72: transporte web de autenticación preparado».

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

**Atención al arrancar FastAPI:** el lifespan consulta PostgreSQL. Las pruebas deben usar los runners aislados; no iniciar el servicio con credenciales del proyecto para probar autenticación.

Next.js usa `FASTAPI_ORIGIN=http://127.0.0.1:8000` por defecto. Para personalizarlo,
crear `frontend-next/.env.local` a partir de `.env.example`, sin sobrescribir un
archivo existente. Es una variable exclusiva del servidor, sin `NEXT_PUBLIC_`.
No usar credenciales, rutas, query o fragmento en el origen ni apuntarlo a Next.js.
Reiniciar desarrollo tras cambiarla; en producción los rewrites se generan al
compilar, por lo que se debe volver a compilar y reiniciar.

## Rutas actuales y flujo preparado

| URL en el puerto 3000 | Responsable actual |
| --- | --- |
| `/` | Login React sin Sidebar; envío al adaptador web |
| `/registro` | Registro React; envío al adaptador web |
| `/verificar` | Verificación y reenvío mediante adaptador web |
| `/inicio` | Inicio React protegido, listado de arriendos con búsqueda y filtros FastAPI |
| `/inicio?vista=personas` | Inicio React protegido, búsqueda de personas por zona, presupuesto y ocupación |
| `/publicar` | Selector y formulario React protegidos para crear publicaciones |
| `/navegacion` | Guía protegida, ejemplo de modal y accesos al HTML antiguo |
| `/acceso`, `/legacy/acceso` | Login/registro HTML original, FastAPI `/` |
| `/legacy/inicio` | Inicio HTML original, FastAPI `/inicio` |
| `/crear`, `/legacy/crear` | FastAPI `/crear` |
| `/perfil` | Perfil React autenticado, edición y estado de verificación del correo |
| `/legacy/perfil` | HTML original de FastAPI `/perfil` |
| `/web-api/perfil` | GET/PUT de servidor para consultar y editar el perfil propio |
| `/web-api/publicaciones` | POST de servidor para crear publicaciones con JWT y formulario multipart |
| `/mis-publicaciones`, `/legacy/mis-publicaciones` | FastAPI `/mis-publicaciones` |
| `/editar-publicacion?id=…`, `/legacy/editar-publicacion?id=…` | FastAPI `/editar-publicacion?id=…` |

Flujo preparado: registro confirmado → `/verificar`; verificación confirmada → `/`; login confirmado → `/inicio`. Las rutas del grupo `(app)` comprueban la sesión con FastAPI en cada petición; ante sesión ausente redirigen a `/` y ante indisponibilidad bloquean el contenido. Los grupos `(auth)` y `(app)` mantienen layouts separados y no aparecen en las URL.

El listado de arriendos consulta `/api/publicaciones` y envía la búsqueda y filtros de precio, cupos, categoría, tipo de vivienda y mascotas a FastAPI. La pestaña Personas consulta `/conexiones/usuarios/buscar`. Crear una publicación envía `multipart/form-data` a `/web-api/publicaciones`; el adaptador valida los campos, obtiene el JWT desde la cookie HttpOnly y lo transmite al endpoint protegido de FastAPI.

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
│   │   ├── page.tsx                 # /, login React
│   │   └── registro/page.tsx        # /registro, registro React
│   └── (app)/
│       ├── layout.tsx               # AppShell con validación de sesión en servidor
│       ├── inicio/page.tsx
│       ├── publicar/page.tsx
│       └── navegacion/page.tsx
├── components/
│   ├── layout/                      # Header, Sidebar, AppShell, navegación,
│   │                                # UserMenu, PageHeader y PromoCard
│   └── ui/                          # Icon, Button, Card, EmptyState, Tabs, Modal
├── features/
│   ├── auth/                        # Pantallas, formulario, campos y validación
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

- `/api/:path*`: proxy para los contratos de datos.
- `/auth/:path*`: retirado del proxy; ruta local con 410 para no filtrar JWT. Usar `/web-api/auth/*`.
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
contratos existentes. El detalle de edición `/api/publicaciones/{id}` ahora exige Bearer y propietario (401/404); el catálogo público conserva su acceso.

`apiRequest<T>` está destinado a futuras llamadas desde el navegador con rutas
relativas de `/api/` y `/conexiones/`. El helper aún admite `/auth/` sintácticamente, pero esas URL devuelven 410; para autenticación usar el cliente de `features/auth`. Usa `credentials: same-origin`,
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
El backend JWT adaptado rechaza `roomies_id`, tokens demo y el usuario predeterminado. El nuevo transporte web utiliza una cookie HttpOnly y envía Bearer exclusivamente desde servidor. Los clientes HTML anteriores requieren adaptar su transporte; conservar los rewrites no les proporciona autenticación JWT automáticamente.

Usar un origen consistente: localhost y 127.0.0.1 tienen cookies distintas. El adaptador web valida un origen configurado, exige cabecera CSRF y no habilita CORS. Los permisos siempre se comprueban en FastAPI; el layout solo controla el acceso a las páginas React.

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
en paralelo. SCRUM-78 incorpora la edición de perfil y confirmación de correo en React; administración sigue pendiente. Registro usa el adaptador web y requiere habilitar el entorno de pruebas aislado descrito en [MANUAL.md](../tests/e2e/MANUAL.md).

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
npm run test:auth
npm run test:session
npm run test:profile
npm run test:proxy
```

Para probar la compilación: `npm start` después de detener el servidor de
desarrollo del puerto 3000. ESLint se ejecuta separado del build.

- Lint, typecheck y build comprueban la estructura reorganizada.
- test:api: seis casos en memoria, sin red ni base de datos.
- test:auth: trece pruebas de validación y navegación en memoria, sin red, usuarios ni sesiones.
- test:session: 15 casos de autenticación web con transporte simulado y HTTP local.
- test:proxy: diez casos HTTP más el contenedor de Node. Next.js usa 3000 y un
  upstream aislado usa un puerto libre. Se comprueban React, aliases HTML,
  recursos, parámetros, cookies sintéticas, estados 401/422, rutas desconocidas
  formularios sin Sidebar, cookie HttpOnly y protección de rutas con un doble del backend.
- La fixture lee los archivos HTML originales sin ejecutarlos. No inicia FastAPI,
  no usa credenciales, no emite roomies_id y no abre conexiones a PostgreSQL.
- Las carpetas .proxy-test-* son temporales e ignoradas; no copian .env y se
  limpian junto con sus procesos. En Windows el entorno restringido puede impedir
  terminar procesos; ejecutar con la autorización correspondiente.
- Tras mover rutas, puede quedar un validator de desarrollo obsoleto en
  .next/dev/types. Detener el servidor de desarrollo y regenerar los tipos;
  no cambiar tsconfig ni excluir errores reales para ocultarlo.

La prueba conjunta navegador → Next.js → FastAPI → PostgreSQL con SMTP local STARTTLS está implementada en `../tests/e2e/`. Ejercita el lifespan y SQL reales sin servicios externos. Resultados y límites: `../tests/e2e/RESULTS.md`. El detalle de edición y el passthrough de auth se corrigieron tras detectar accesos inseguros. No se modifica el frontend original ni se conecta a Supabase.

## SCRUM-72: transporte web de autenticación preparado

La implementación actual reemplaza los avisos de validación local de etapas anteriores. Por defecto permanece deshabilitada: `WEB_AUTH_ENABLED=false` (también si falta). No se cambió la configuración del backend ni se activó producción.

- `POST /web-api/auth/registro`, `/verificar`, `/reenviar-codigo`, `/login`, `/logout`.
- `GET /web-api/auth/sesion`: consulta `/api/perfil` con Bearer; devuelve únicamente `{ authenticated: true, user: { nombre } }`. No existe `/auth/sesion` en FastAPI.
- Login confirma la vigencia con FastAPI antes de establecer cookie. El JSON del navegador no contiene JWT ni credenciales de respuesta.
- Cookie host-only, HttpOnly, SameSite=Strict, Path=/, Secure y prefijo `__Host-` en HTTPS. Expira como máximo al `exp` del token (tope de retención 24 horas). La lectura de `exp` no autoriza: firma, vigencia y revocación siempre se validan en FastAPI.
- HTTP solo se permite en loopback para desarrollo; usa nombre distinto `haycupo_dev_session`. Con `NODE_ENV=production` se exige HTTPS para la web. No hay refresh token: al expirar se exige iniciar sesión nuevamente.
- Operaciones POST exigen Origin exacto configurado, cabecera `X-Haycupo-CSRF: 1`, JSON y Fetch Metadata compatible cuando está presente. Se ignoran Host, X-Forwarded-*, Authorization y cookies ajenas aportadas por el navegador al construir la petición upstream. No se habilita CORS.
- El backend es un origen fijo, sin credenciales/rutas/query, configurado exclusivamente en servidor mediante `WEB_AUTH_FASTAPI_ORIGIN`. Transporte sin caché, timeout y sin seguir redirecciones.
- `/inicio`, `/publicar`, `/navegacion` requieren sesión válida en el layout dinámico `(app)`. Si no hay sesión redirigen a `/`; ante fallo del servicio muestran acceso no disponible, sin presentar contenido privado. Cada futura operación con datos deberá volver a autorizarse en servidor; un layout no sustituye esa comprobación.
- Logout revoca la sesión en FastAPI antes de borrar cookie. Un 401/403 limpia una sesión ya inválida. Un 503 conserva cookie y muestra que la revocación no se confirmó; no afirma haber cerrado sesión.
- Se conservan validaciones, accesibilidad, layouts y diseños. Se envían formularios solo tras validación; registro confirmado navega a `/verificar`, verificación confirmada a `/`, login confirmado a `/inicio`. No se pasan correo/códigos/contraseñas por URL ni almacenamiento persistente del navegador. Reenvío respeta `Retry-After` cuando el backend lo proporciona.
- Errores 401, 403, 409, 422, 429 y 503 se conservan con mensajes controlados. Fallos de red, respuestas inválidas o fallos internos son 503 y no generan cookie. Ante fallo SMTP el backend puede haber conservado una cuenta pendiente: no se afirma que no se haya creado.

### Pruebas y habilitación en un entorno aislado

`npm run test:session` usa contratos y transporte HTTP contra un doble local de FastAPI; todos sus tokens y perfiles son fixtures. `npm run test:proxy` arranca una copia temporal de Next.js sin archivos .env, con entorno permitido explícitamente, y verifica rewrites, handlers reales, cookies y acceso a rutas privadas con ese doble. En Windows puede requerir permisos para cerrar exclusivamente el árbol del servidor temporal. Ninguno inicia FastAPI real ni SMTP.

Ejecutar lint, typecheck, build, test:api, test:auth, test:session y test:proxy. El build no debe precalcular las rutas privadas: su layout tiene `dynamic=force-dynamic`, independientemente de la bandera de activación en build.

Para una prueba manual completa: preparar PostgreSQL dedicado con esquema aprobado y migración V2; usar secretos generados solo para pruebas y SMTP capturado localmente; arrancar FastAPI con JWT habilitado únicamente allí. Configurar Next.js con los tres parámetros `WEB_AUTH_ENABLED=true`, `WEB_AUTH_ORIGIN` exacto y `WEB_AUTH_FASTAPI_ORIGIN` de ese servicio. En build/start usar HTTPS para la web; la excepción HTTP es solo para `next dev` en loopback. Mantener producción deshabilitada.

Los rewrites de datos y recursos se conservan; el namespace `/auth/*` se retiró deliberadamente por exponer el JWT. El contrato FastAPI servidor-servidor se conserva. Los clientes HTML y el cliente API genérico de publicaciones/conexiones NO reciben automáticamente el Bearer: requieren su propia migración a transporte autenticado de servidor. No se expone JWT a JavaScript para mantenerlos funcionando. No se implementó recuperación de cuentas antiguas, OAuth ni un endpoint backend de sesión nuevo. La edición del perfil se añade en SCRUM-78. Coordinar los contratos de consumidores antiguos antes de habilitarlos.


## Prueba conjunta con servicios reales desechables

Consultar `../tests/e2e/README.md` para el comando, requisitos, aislamiento y recorridos. Se utiliza Edge headless con contexto nuevo, FastAPI/Uvicorn real, PostgreSQL 18.6 temporal y SMTP local con STARTTLS/AUTH. No se utiliza .env, Supabase ni credenciales reales. Las pruebas de permisos de perfil/CRUD usan HTTP con Bearer únicamente en el driver de pruebas, sin entregar ese token al JavaScript de la aplicación. Los formularios de autenticación y la consulta de sesión sí se ejercitan desde navegador real.

Cambios que requieren coordinación: consumidores web de `/auth/*` reciben ahora 410 y deben migrar a `/web-api/auth/*`; detalle privado de edición exige JWT y propietario. El catálogo de descubrimiento sigue siendo público. Falta adaptar el transporte del HTML antiguo y repetir en HTTPS con el reverse proxy definitivo antes de producción.


## Perfil autenticado — SCRUM-72 y SCRUM-78

`/perfil` vive en `(app)` y reutiliza AppShell, Sidebar, PageHeader, Card, Icon,
Button y EmptyState. Sidebar y «Ver mi perfil» del menú de cuenta apuntan a React;
`/legacy/perfil` y los archivos HTML originales permanecen disponibles como referencia.
SCRUM-78 añade el formulario de edición y la sección «Verificación de cuenta».
El contrato, límites, pruebas y aprobación pendiente del cambio de Jira se
documentan en [SCRUM-78.md](../docs/SCRUM-78.md).

El cliente consulta `GET /web-api/perfil` con credenciales del mismo
origen. El handler `src/lib/perfil/server.ts` lee la cookie HttpOnly existente y
consulta la URL fija FastAPI `GET /api/perfil` con `Authorization: Bearer`.
No acepta una identidad del cliente, no reenvía query/Authorization/Cookie del
navegador, no guarda tokens en JS ni altera contratos de autenticación.
FastAPI sigue verificando firma, expiración, usuario verificado y sesión revocada.
La edición envía `FormData` a `PUT /web-api/perfil`, con validación de Origin y
cabecera CSRF. Next.js usa la misma cookie para transmitir Bearer al PUT de
FastAPI; el cliente no puede elegir otro usuario ni editar `verificado`.
La respuesta web contiene solo nombre, edad, ocupación, ciudad, descripción breve,
sobre mí, fotografía, total de publicaciones y estado `verificado`. No incluye correo, contraseña, IDs
ni campos extra del upstream. Respuesta y transporte usan `no-store`, `Vary: Cookie`
y rutas dinámicas, sin caché compartida entre usuarios.

Estados de interfaz: carga accesible; datos confirmados; campos vacíos con «Sin
indicar»; 404 como perfil no disponible; error de servicio con Reintentar; 401/403
como sesión expirada con enlace a login y eliminación de cookie inválida. Una
petición abortada por navegación no actualiza la vista y el timeout se maneja
como error. Cero publicaciones se muestra como cero, sin inventar estadísticas.
La fotografía admite los recursos actuales `/imagenes/*.png|jpg|jpeg|webp`; URLs
externas u otros formatos no se cargan. Si falta/falla se muestra un avatar. No se
usa HTML sin escapar para nombres o descripciones.

La edad se normaliza desde número o texto numérico del contrato anterior; el
backend representa valores ausentes con cadena vacía. El adaptador web usa null
para campos opcionales vacíos y devuelve 503 controlado ante un cuerpo incompatible,
un error del backend, timeout o fallo de red, sin reflejar detalles internos.

Pruebas unitarias del adaptador: `npm run test:profile`. La suite
`test:proxy` incluye la prioridad de React sobre fallback HTML, el handler real,
rechazo anónimo, protección de escrituras y conservación del alias original. Para activar
además las comprobaciones de navegador contra el mismo backend HTTP simulado:

```powershell
$env:PROFILE_BROWSER_TESTS='1'
$env:PROFILE_PLAYWRIGHT_PATH='C:/Users/gerla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:PROFILE_BROWSER_PATH='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm run test:proxy
```

El navegador comprueba carga, datos/foto, dos identidades aisladas, campos vacíos,
perfil inexistente, error/reintento y sesión expirada. También verifica navegación
por teclado, ausencia de tokens accesibles y anchuras 1440/768/390 sin desborde.
La copia temporal de Next no incluye .env; no se arranca PostgreSQL ni se ejecuta
SQL. Las rutas de Playwright/Edge deben apuntar a instalaciones locales existentes.
Se requiere permiso para cerrar exclusivamente los procesos temporales en Windows.

La base de SCRUM-72 aprobó 27 recorridos E2E. SCRUM-78 amplía esa suite a **31/31** con edición, fotografía, estado del correo y protección CSRF. La migración V2 se aplica exclusivamente en la base desechable; no se consulta Supabase. Los resultados finales y el inventario para commits están en [SCRUM-78-final-review.md](../docs/SCRUM-78-final-review.md).

Antes de habilitar un entorno real siguen pendientes HTTPS/proxy, revisión de ACL/RLS y esquema aprobado, y recuperación de cuentas antiguas. La edición está implementada en SCRUM-78; confirmar el correo no verifica la identidad legal y sustituir el requisito documental de Jira requiere aprobación del equipo/profesor. El layout aún consulta `/api/perfil` para comprobar sesión: un fallo del
servicio en la carga inicial puede mostrar «Sesión no disponible» antes de montar
la página; la vista maneja fallos posteriores de su propia consulta.
