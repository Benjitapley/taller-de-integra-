# SCRUM-78: edición de perfil y confirmación de correo

Trabajo local en `SCRUM-78-Implementar-edición-de-perfil-y-solicitud-de-verificación`,
verificada antes de editar; `dev-web` es ancestro de esta rama. Sin commits,
push, merge, PR ni operaciones en Supabase.

## Análisis del sistema existente

- `frontend/PerfilU/perfil.html` y `perfil.js`: formulario multipart con `edad`,
  `ocupacion`, `ciudad`, `breve_descripcion`, `sobre_mi` y archivo `foto` opcional.
  Precarga los datos, hace PUT y vuelve a consultar GET. Los originales se conservan.
- FastAPI `GET/PUT /api/perfil` trabaja sobre `haycupo.usuario`. La biografía
  visible corresponde a `sobre_mi`; la columna `biografia` no participa en este
  contrato. Nombre, correo, fecha de nacimiento y `verificado` no son editables.
- La fotografía se escribe en `backend/main/imagenes/` con nombre aleatorio y
  su ruta `/imagenes/<nombre>` se guarda en `usuario.foto_perfil`. No se utiliza
  Supabase Storage. Sin archivo nuevo se conserva la fotografía anterior.
- Ambos endpoints reciben el usuario exclusivamente de `get_current_user`:
  JWT firmado, sesión activa, usuario existente y correo confirmado. No toman
  un ID de la URL o del formulario para decidir qué usuario editar.
- SCRUM-72 ya usa `usuario.verificado` para confirmación de correo, no identidad.
  Login y autenticación privada rechazan cuentas pendientes. El perfil privado
  no es accesible normalmente antes de confirmar el correo.

## Comportamiento implementado

`/perfil` incorpora «Editar perfil» usando el modal y los botones compartidos.
Precarga los seis campos, muestra una vista previa local de fotografía, permite
cancelar y bloquea los controles durante el guardado. Descarta los cambios al
cancelar y libera las URL de previsualización al reemplazarlas o cerrar.

El navegador envía `FormData` a `PUT /web-api/perfil`, con credenciales del mismo
origen y `X-Haycupo-CSRF: 1`. El handler exige Origin configurado, comprueba
Sec-Fetch-Site si existe, obtiene el JWT de la cookie HttpOnly y lo transmite
como Bearer únicamente al destino fijo `/api/perfil` de FastAPI. No devuelve
tokens ni acepta IDs, `verificado`, campos repetidos o campos ajenos. No cambia
JWT ni guarda credenciales en localStorage/sessionStorage.

Se corrigió el modal compartido para ignorar un evento de cierre antiguo cuando
el diálogo ya fue reabierto por los efectos de React Strict Mode. La prueba real
detectó el cierre inmediato del editor y la repetición confirmó la corrección.

Se conserva la semántica de reemplazo completo del formulario original: los
textos vacíos se guardan vacíos; edad vacía se convierte a NULL. No existe una
operación de eliminación de foto en el contrato original. Tras un PUT correcto
se vuelve a consultar GET sin caché y se actualiza la pantalla sin cerrar sesión.
Un fallo de recarga posterior se distingue de un guardado confirmado; ante un
error de transporte se advierte que el guardado no quedó confirmado.

Límites de aplicación, comprobados en Next.js y FastAPI:

| Campo | Almacenamiento / validación |
| --- | --- |
| Edad | Entero de 0 a 120 o NULL |
| Ocupación | `usuario.ocupacion`, máximo 100 caracteres |
| Ciudad | `usuario.ciudad`, máximo 100 caracteres |
| Descripción breve | `usuario.breve_descripcion`, máximo 255 caracteres |
| Biografía | `usuario.sobre_mi`, máximo 5000 caracteres |
| Fotografía | JPG/PNG/WEBP, máximo 5 MiB y 20 megapíxeles |

El backend comprueba el contenido con Pillow, conserva la extensión del formato
detectado y elimina el archivo nuevo si falla la transacción. Ya no trunca fotos
mayores de 5 MiB ni trata cualquier archivo como PNG. El handler limita la lectura
del cuerpo a 5 MiB más 64 KiB para campos y envoltorio multipart.

GET agrega `verificado` al contrato público del perfil y devuelve textos vacíos
como vacíos para no guardar mensajes de presentación al editar. Los placeholders
pertenecen a la interfaz; el HTML original sigue funcionando con el mismo formato.

## Propuesta de cambio respecto de Jira: requiere aprobación

**Requisito original:** fotografía del carné y revisión administrativa para
verificación de identidad. **Propuesta implementada para revisión:** reutilizar
la confirmación de correo de SCRUM-72 y mostrar su estado en el perfil.

El equipo o profesor debe aprobar esta sustitución y actualizar Jira y sus
criterios de aceptación antes de considerar satisfecho el requisito original.
La confirmación de correo solo demuestra control del buzón. No acredita nombre,
edad, documento ni identidad legal. No se solicitan documentos ni se implementa
revisión administrativa, y no se crea otro sistema de códigos.

- Sección «Verificación de cuenta» en `/perfil`.
- `verificado: true`: «Correo verificado», sin pedir otro código.
- `verificado: false`: «Correo pendiente de verificación» y el formulario compartido
  de SCRUM-72 para verificar o reenviar el código. El correo se introduce en el
  formulario; no se añade al contrato del perfil ni de sesión.
- Campo ausente/no booleano: estado desconocido; nunca se presume confirmación.
  Se ofrece una consulta nueva al servidor para recuperar el estado.

`VerificationForm` conserva su comportamiento público en `/verificar`: después
de confirmar, vuelve al acceso. Dentro del perfil usa un callback que recarga
`GET /web-api/perfil` sin cerrar sesión ni navegar fuera. No cambia `verificado`
de manera optimista ni asume que verificar otro correo haya verificado el perfil
actual: el valor mostrado procede siempre de la consulta autenticada. También
ofrece «Ya verifiqué mi correo: actualizar estado» para confirmaciones realizadas
en otra pestaña. Una sesión vencida durante la consulta elimina la cookie y muestra
el acceso para iniciar sesión; una caída del servicio permite reintentar.

La rama pendiente del componente se prueba con un doble aislado por ser
inalcanzable durante un login normal con la política JWT actual. Una cuenta
pendiente real completa `/verificar` antes del login. El formulario compartido usa
`/web-api/auth/verificar` y
`/web-api/auth/reenviar-codigo`, que llaman a los endpoints existentes de FastAPI.
Se conservan código de seis dígitos, caducidad predeterminada de 15 minutos,
consumo único, cinco intentos, espera de 60 segundos entre envíos y cinco envíos
por hora. No se modifica esa lógica ni se relajan los permisos para acceder al
perfil con una cuenta pendiente.

La sesión web sigue exponiendo solo el nombre necesario para la navegación;
`verificado` ya se obtiene del perfil protegido por JWT y sesión activa. No se
agregaron endpoints, tablas ni permisos. Si el equipo quisiera permitir login
pendiente y acceso a `/perfil` antes de confirmar el correo, tendría que aprobar
por separado ese cambio de autorización; no forma parte de esta implementación.

No se propone ninguna migración nueva: se usan columnas existentes. Las pruebas
con PostgreSQL usan una fixture desechable y no certifican los tipos/límites del
esquema de producción. Antes de integrar corresponde contrastar los límites
de aplicación con el esquema aprobado. Si requiere ajustes SQL, deben presentarse
como propuesta separada y no ejecutarse automáticamente.

La integración requiere el despliegue coordinado de Next.js y FastAPI y la
configuración segura ya prevista por SCRUM-72. El almacenamiento persistente de
imágenes y la limpieza de fotografías antiguas conservan la responsabilidad del
despliegue existente; no se migran a otro proveedor en esta tarea.

## Archivos

Nuevos:

- `frontend-next/src/features/perfil/ProfileEditor.tsx`
- `frontend-next/src/features/perfil/AccountVerification.tsx`
- `frontend-next/src/features/perfil/validation.ts`
- `frontend-next/tests/build-isolated.mjs`
- `frontend-next/tests/auth-client.test.mjs`
- `backend/tests/test_profile.py`
- `docs/SCRUM-78.md`

Modificados:

- `frontend-next/src/features/perfil/ProfileView.tsx`, `contracts.ts`, `perfil.module.css`
- `frontend-next/src/features/auth/VerificationForm.tsx` (callback para refrescar el perfil)
- `frontend-next/src/lib/perfil/server.ts`
- `frontend-next/src/components/ui/Modal.tsx` (evento de cierre pendiente en Strict Mode)
- `frontend-next/src/app/web-api/perfil/route.ts`
- `frontend-next/package.json`
- `frontend-next/tests/profile.test.mjs`, `profile-browser.mjs`, `proxy.test.mjs`
- `backend/main/main.py`
- `backend/tests/conftest.py`, `test_auth.py`
- `tests/e2e/browser.mjs`

El inventario final completo, incluido el entorno manual, el README y la división
propuesta de commits, está en [SCRUM-78-final-review.md](SCRUM-78-final-review.md).

## Validación reproducible

Desde la raíz:

```powershell
.\.venv\Scripts\python.exe -I -B backend/tests/run_isolated.py
```

Desde `frontend-next`:

```powershell
node --test tests/api-client.test.mjs tests/auth-validation.test.mjs tests/auth-gateway.test.mjs tests/auth-client.test.mjs tests/profile.test.mjs
npm run lint
npm run typecheck
npm run build:isolated
$env:PROFILE_BROWSER_TESTS='1'
$env:PROFILE_PLAYWRIGHT_PATH='C:/Users/gerla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:PROFILE_BROWSER_PATH='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node --test tests/proxy.test.mjs
```

Para PostgreSQL, SMTP STARTTLS y navegador reales desechables, usar el comando de
`tests/e2e/README.md`. La suite mantiene los casos de SCRUM-72 y agrega edición,
cancelación, previsualización, validación, error recuperable, persistencia,
aislamiento entre cuentas y protección CSRF. La migración de SCRUM-72 solo se
ejecuta contra el clúster temporal, nunca en Supabase.

`build:isolated` ejecuta `next build` con una copia temporal de las fuentes, sin
copiar `.env*`, con entorno permitido explícitamente y red externa bloqueada.
Los runners HTTP y de backend también usan servicios locales o dobles aislados.

Resultados finales:

- Backend aislado: **76/76** pruebas, con dobles de BD y correo y bloqueo de I/O real.
  La revisión final añade una regresión para rechazar una edad de miles de dígitos
  con 422 antes de convertirla a entero; no provoca un error interno ni escrituras.
- Unitarias Next.js: **53/53** pruebas, incluyendo multipart, identidad fija,
  validación, límites de tamaño, CSRF y errores de sesión/servicio.
- HTTP y navegador con doble local: **13/13** controles, incluyendo perfil,
  estados pendiente/desconocido, teclado, resoluciones y bytes del HTML original.
  La verificación pendiente comprueba errores de código y de servicio, reenvío,
  bloqueo local por `Retry-After`, reconsulta sin logout, sesión vencida al terminar,
  y que un 200 sin cambio en el perfil no muestre un falso «Correo verificado».
- Integración Edge → Next.js → FastAPI → PostgreSQL y SMTP STARTTLS desechables:
  **31/31** recorridos; cero errores JavaScript y cero peticiones externas de la
  aplicación. Se comprobaron precarga, cancelación, validación, foto, controles
  deshabilitados durante guardado, recuperación de un 503, persistencia tras
  recarga, separación de cuentas y rechazo de campos de identidad/CSRF.
- `lint`, `typecheck` y `next build` aislado: correctos.
- Los runners retiraron sus servidores, contextos y recursos temporales.

Advertencias existentes en las pruebas: deprecaciones de Starlette/httpx,
configuración Pydantic y aiosmtpd. No impidieron ninguna comprobación.
