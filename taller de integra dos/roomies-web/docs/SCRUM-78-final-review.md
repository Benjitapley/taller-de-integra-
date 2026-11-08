# SCRUM-78 — revisión final y propuesta de commits

Fecha de revisión: 25 de octubre de 2026. Estado: revisión técnica completada;
listo para la revisión del usuario antes de autorizar commits locales.
Este documento prepara commits locales; no autoriza ni ejecuta commits, push,
merge, rebase, PR ni cambios de Jira o producción.

## Estado exacto de Git

- Rama: `SCRUM-78-Implementar-edición-de-perfil-y-solicitud-de-verificación`.
- `HEAD`, `dev-web` y la referencia local `origin/dev-web`:
  `924fa061ec8901f569d8e03a3904e42d9253874e`.
- Ese commit es el merge de SCRUM-72. Incluye `f397c6c` (integración Next.js),
  `3d2acf7` (JWT/FastAPI) y `e9cdc7e` (migración V2, E2E y documentación).
- Comparación de historia `origin/dev-web...HEAD`: **0 detrás / 0 delante**.
  Todo SCRUM-78 está en el árbol de trabajo, todavía sin commits propios.
- **20 archivos modificados y 12 nuevos sin seguimiento: 32 candidatos**.
  No hay eliminados, renombrados ni archivos preparados en el índice.
- La comparación usa la referencia remota local existente; no se hizo fetch
  ni se afirma haber consultado el estado actual del servidor remoto.
- El HTML original, `backend/auth_service/`, los SQL de migración, `.env.example`,
  los archivos de bloqueo y las dependencias declaradas no tienen cambios.

## Alcance y seguridad revisados

La edición acepta edad, ocupación, ciudad, descripción breve, `sobre_mi` y una
fotografía opcional. Next.js valida Origin, CSRF, campos y tamaño; toma el token
solo de la cookie HttpOnly y lo envía como Bearer a una URL fija de FastAPI.
No reenvía IDs, query de usuario ni Authorization elegido por el navegador.
FastAPI conserva `Depends(get_current_user)` y actualiza exclusivamente
`WHERE id_usuario = %s` usando el usuario del JWT. Las pruebas con dos cuentas
comprueban que no se alteren perfiles ajenos.

JWT sigue validando firma, expiración, sesión activa/revocación y correo confirmado.
No se guarda en localStorage/sessionStorage ni se devuelve al navegador en JSON.
La fotografía se comprueba con Pillow, no se trunca, recibe nombre aleatorio y
se retira si falla la transacción. No elegir archivo conserva la foto existente.

La sección «Verificación de cuenta» usa el booleano del GET autenticado y el
formulario de SCRUM-72. Reutiliza verificar/reenvío, validaciones, caducidad,
intentos y límites. No hay otro generador de códigos, tabla, migración ni sistema
documental. Tras verificar se consulta el perfil otra vez; un 200 de verificación
no basta para asumir que el perfil actual esté confirmado.

Una cuenta pendiente normal no puede iniciar sesión ni abrir `/perfil` con la
política de SCRUM-72. Esa rama del componente se cubre con un doble aislado. El
recorrido real registra, confirma y después inicia sesión. No se debilita JWT
para hacer accesible una pantalla pendiente. Se comprueba además que una sesión
existente pueda volver a consultar el perfil tras restablecer la confirmación,
sin emitir otro JWT.

El entorno manual/E2E borra la configuración heredada antes de importar la app,
bloquea `.env*`, usa DSN y puertos de loopback generados, restringe psycopg al DSN
exacto y SMTP a su receptor local. Next.js bloquea DNS/sockets externos. SMTP
exige STARTTLS/AUTH y solo captura destinatarios sintéticos; el modo manual
rechaza direcciones fuera de `@example.com`. Los códigos solo se muestran en su
terminal, nunca mediante endpoints de producción. El control privado de fixtures
no se inicia en el modo manual.

## Hallazgo corregido durante esta revisión

La validación de edad convertía cualquier cadena decimal a entero antes de
limitar su longitud. Una entrada con miles de dígitos podía superar el límite
de conversión de Python y producir 500. Se limita a tres dígitos antes de `int`,
igual que en Next.js, y se añade el caso de 5000 dígitos a la prueba parametrizada.
El resultado esperado es 422 sin modificar el perfil. No añade funcionalidad.

También se actualiza el README de Next.js: todavía describía el perfil como solo
lectura y la edición como pendiente. Los demás cambios locales se conservan.

## Candidatos al commit: inventario completo

`M`: modificado respecto de `origin/dev-web`. `N`: nuevo, todavía sin seguimiento.
La columna de commit es una propuesta; no se ha ejecutado `git add`.

| Estado | Archivo | Commit |
| --- | --- | --- |
| M | `backend/main/main.py` | 1 |
| M | `backend/tests/conftest.py` | 1 |
| M | `backend/tests/test_auth.py` | 1 |
| N | `backend/tests/test_profile.py` | 1 |
| M | `frontend-next/package.json` | 1 |
| M | `frontend-next/src/app/web-api/perfil/route.ts` | 1 |
| M | `frontend-next/src/components/ui/Modal.tsx` | 1 |
| M | `frontend-next/src/features/auth/VerificationForm.tsx` | 1 |
| N | `frontend-next/src/features/perfil/AccountVerification.tsx` | 1 |
| N | `frontend-next/src/features/perfil/ProfileEditor.tsx` | 1 |
| M | `frontend-next/src/features/perfil/ProfileView.tsx` | 1 |
| M | `frontend-next/src/features/perfil/contracts.ts` | 1 |
| M | `frontend-next/src/features/perfil/perfil.module.css` | 1 |
| N | `frontend-next/src/features/perfil/validation.ts` | 1 |
| M | `frontend-next/src/lib/perfil/server.ts` | 1 |
| N | `frontend-next/tests/auth-client.test.mjs` | 1 |
| N | `frontend-next/tests/build-isolated.mjs` | 1 |
| M | `frontend-next/tests/profile-browser.mjs` | 1 |
| M | `frontend-next/tests/profile.test.mjs` | 1 |
| M | `frontend-next/tests/proxy.test.mjs` | 1 |
| M | `tests/e2e/browser.mjs` | 1 |
| M | `tests/e2e/README.md` | 2 |
| N | `tests/e2e/MANUAL.md` | 2 |
| M | `tests/e2e/backend_server.py` | 2 |
| N | `tests/e2e/isolation-checks.cjs` | 2 |
| N | `tests/e2e/manual.test.mjs` | 2 |
| M | `tests/e2e/network-guard.cjs` | 2 |
| M | `tests/e2e/run_e2e.py` | 2 |
| N | `tests/e2e/start-manual.ps1` | 2 |
| M | `frontend-next/README.md` | 3 |
| N | `docs/SCRUM-78.md` | 3 |
| N | `docs/SCRUM-78-final-review.md` | 3 |

## Archivos excluidos y revisión de secretos

Se revisa la unión de `git diff --name-only origin/dev-web` y
`git ls-files --others --exclude-standard`, no solo los archivos ya seguidos.
No hay `.env`, claves/certificados, bases temporales, imágenes subidas, logs,
`node_modules`, `.next`, `__pycache__`, `.venv`, resultados de ejecución ni copias
`.proxy-test-*` entre los candidatos.

El escaneo de contenido no detecta claves privadas, JWT literales, tokens de
servicio ni URLs de Supabase. Las dos coincidencias de URI PostgreSQL se revisan:
una construye el DSN efímero con contraseña generada y loopback; la otra es la
configuración ficticia `blocked.invalid` que la prueba introduce para comprobar
que no se herede. Los secretos generados en ejecución no se incluyen en Git.

Los `.env` y las dependencias locales existentes se mantienen ignorados, no se
eliminan. Se comprueban las reglas de exclusión con `git check-ignore`.
Las rutas de Node/Playwright y correos/contraseñas de fixtures presentes en el
código/documentación son referencias locales o datos sintéticos, no credenciales
reales. Este escaneo es una revisión de los candidatos, no una garantía sobre
archivos ignorados ni sobre toda la historia anterior del repositorio.

## Validación final

| Comprobación | Resultado |
| --- | --- |
| Backend aislado y regresión de edad | 76/76 |
| Unitarias Next.js | 53/53 |
| HTTP/navegador con doble local | 13/13 |
| E2E real con PostgreSQL y SMTP desechables | 31/31 |
| Modo manual: recorrido, salir, EOF, SIGINT | 3/3 |
| Lint y typecheck | Correctos |
| Build aislada (`next build`) | Correcta |
| Parser PowerShell y sintaxis Node | Correctos |
| `git diff --check` | Sin errores |

La primera ejecución concurrente de HTTP/navegador agotó el límite de 120 segundos
y canceló los controles restantes. Se repitió sola, sin cambiar el límite ni el
código de la suite: **13/13 en 33,4 segundos**. No se presenta el intento cancelado
como una ejecución aprobada. Las otras suites finalizaron correctamente.

Las pruebas del modo manual comprobaron cierre de sus cuatro puertos y eliminación
de los directorios generados por las tres formas de parada admitidas. El E2E
confirmó cero solicitudes externas de la aplicación y ausencia de errores JavaScript.
No quedan copias temporales ni clústeres de estas ejecuciones en el proyecto o TEMP.

Las instrucciones reproducibles están en `docs/SCRUM-78.md` y
`tests/e2e/MANUAL.md`. No se utilizan servicios de producción. La migración V2 se
ejecuta únicamente en los clústeres efímeros. Las advertencias existentes de
Starlette/httpx, Pydantic y aiosmtpd se mantienen fuera del alcance de SCRUM-78.

## Commits locales propuestos, en este orden

1. **`SCRUM-78 feat: editar perfil propio y mostrar verificación de correo`**
   (21 archivos). Cambio vertical completo: backend, contrato, transporte seguro,
   componentes, corrección del modal, validaciones y pruebas de perfil/correo.
   Incluye el helper de build y los scripts de package.json para mantener juntos
   los comandos y sus implementaciones. El guard de red ya existe en SCRUM-72.
2. **`SCRUM-78 test: añadir entorno manual aislado y validar su limpieza`**
   (8 archivos). Runner reutilizado, receptor SMTP, barreras de aislamiento,
   launcher PowerShell, pruebas del ciclo de vida y manual de uso.
3. **`SCRUM-78 docs: documentar alcance, revisión y pendientes de Jira`**
   (3 archivos). README actualizado, contratos/resultados y este inventario.

No requiere dividir hunks de un mismo archivo entre commits. Al autorizarse,
preparar únicamente los archivos explícitos de cada grupo y revisar
`git diff --cached --check` antes de cada commit; evitar un `git add .` global.

## Texto preparado para Jira y pendientes de aprobación

Funcionalidades terminadas técnicamente:

- Edición del perfil propio en React con precarga, validación, fotografía y
  previsualización, cancelación, estados de guardado y errores recuperables.
- Persistencia y actualización sin cerrar sesión, con cookie HttpOnly/Bearer,
  CSRF y aislamiento entre usuarios; HTML original conservado.
- «Verificación de cuenta» con «Correo verificado», estados pendiente/desconocido,
  reutilización de verificación/reenvío y consulta autenticada del estado.
- Entorno manual Windows con PostgreSQL desechable, SMTP capturado, JWT real y
  limpieza comprobada; comandos de inicio/parada documentados.

Pendientes para cerrar Jira e integrar:

- **Equipo/profesor:** aprobar sustituir fotografía del carné y revisión
  administrativa por confirmación de correo. Acredita control del buzón,
  **no identidad legal**. Actualizar descripción y criterios de aceptación.
- Confirmar que verificar antes del login, como exige SCRUM-72, es el flujo
  aprobado. Permitir acceso privado pendiente requeriría otro cambio de alcance.
- Contrastar límites de aplicación con el esquema aprobado y acordar despliegue
  conjunto frontend/backend y almacenamiento persistente de imágenes. La fixture
  temporal no certifica el esquema real; cualquier SQL adicional debe proponerse
  y aprobarse separadamente, sin ejecutarlo automáticamente.
- Revisión del usuario y autorización explícita de los commits locales. Push,
  PR e integración a `dev-web` requieren instrucciones posteriores.

Este texto está listo para copiar a Jira; no se modificó el ticket ni se presupone
la aprobación del cambio de alcance. Las tareas generales ya pendientes de
SCRUM-72 (recuperación de cuentas antiguas, HTTPS y revisión de ACL/RLS) no se
presentan como nuevas funcionalidades implementadas por SCRUM-78.
