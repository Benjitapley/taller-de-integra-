# SCRUM-72 — revisión previa al commit local

Rama comprobada: `SCRUM-72-Conectar-registro-login-sesión-y-perfil-con-Supabase-y-FastAPI`.

Estado al finalizar esta revisión: **16 archivos rastreados modificados,
54 archivos nuevos sin seguimiento, 0 eliminados y 0 preparados en el índice**.
Total recomendado: **70 archivos**. Este informe se incluye en ese total.
No se ejecutó git add, commit, push, merge, cambio de rama ni Pull Request.

## Resultado y alcance

E2E real con PostgreSQL 18.6 propio, SMTP local STARTTLS, FastAPI y Next.js:
27/27 recorridos. Incluye la nueva página y handler de perfil, dos cuentas,
cambio de cuenta en el mismo navegador, expiración, revocación, logout y rechazo
sin sesión. Migración V2 ejecutada solo en el clúster efímero autorizado, no en
Supabase. Todos los servicios temporales quedaron cerrados/eliminados.

Lint, typecheck y build aprobados; 45 unitarias de Next, 12 escenarios HTTP/navegador
más su contenedor, 63 pruebas backend aisladas y 11 estáticas SQL aprobadas.
`git diff --check` y comprobación equivalente de espacios finales en archivos
nuevos sin errores. Avisos de conversión LF/CRLF no son errores de whitespace.

Se revisaron los diffs y las fuentes nuevas contra el alcance acumulado de SCRUM-72:

- Backend JWT, Argon2, verificación HMAC, transacciones, revocación y configuración
  desactivada por defecto; no hay clave JWT predeterminada para producción.
- La dependencia JWT sustituye al ID en cookie/usuario 1 en perfil, publicaciones
  y conexiones. Los cambios de match_conexion_service son necesarios para esta
  protección y para evitar DDL al importar; no son un desarrollo ajeno accidental.
- Next incorpora formularios, cookies HttpOnly/CSRF, layouts protegidos y perfil
  de solo lectura. El antiguo /auth web devuelve 410 para no exponer JWT.
- SQL es una propuesta con preflight/postflight/recuperación y pruebas; incluirlo
  no aplica ninguna migración. Sus encabezados aclaran la validación desechable.
- No se modificaron archivos de frontend/ original, docs/, imágenes reales,
  dependencias npm ni lockfile. No hay interfaz nueva de edición de perfil.
  El PUT de perfil existente solo cambió su dependencia de autenticación;
  no se implementó SCRUM-78.

En esta última etapa solo se ampliaron pruebas E2E y documentación/comentarios;
no se detectó un fallo funcional que exigiera nuevos cambios de contrato.

## Revisión de secretos y artefactos

No hay .env reales, node_modules, .next, bytecode, bases temporales, certificados,
claves privadas, logs ni archivos de compilación entre los candidatos o nombres
rastreados inspeccionados. Los patrones de ignore cubren esos directorios y
las carpetas temporales de las pruebas. `.env.example` se incluye deliberadamente:
solo contiene orígenes loopback y WEB_AUTH_ENABLED=false, sin credenciales.

Escaneo de texto limitado a candidatos (sin abrir .env compartido): no se hallaron
claves privadas, JWT literales completos, credenciales PostgreSQL externas ni
prefijos de secretos de proveedores. Se revisaron además los puntos de carga de
secretos y literales de pruebas. Los passwords de fixtures son ficticios y los
secretos JWT/HMAC/SMTP/BD del runner se generan por ejecución y se eliminan.
Este control no es una garantía matemática de ausencia de cualquier secreto.

## Candidatos exactos para incluir

`M`: archivo ya rastreado modificado. `??`: nuevo, todavía no añadido al índice.
Usar esta lista revisada, no un git add global sobre artefactos ignorados.

```text
?? backend/auth_service/ADAPTATION.md
?? backend/auth_service/config.py
?? backend/auth_service/database.py
?? backend/auth_service/email_service.py
M  backend/auth_service/main.py
?? backend/auth_service/models.py
?? backend/auth_service/requirements-jwt.txt
?? backend/auth_service/security.py
M  backend/main/main.py
M  backend/match_conexion_service/database.py
M  backend/match_conexion_service/models.py
M  backend/match_conexion_service/routes.py
?? backend/tests/conftest.py
?? backend/tests/requirements.txt
?? backend/tests/run_isolated.py
?? backend/tests/test_auth.py
M  frontend-next/.env.example
M  frontend-next/README.md
M  frontend-next/next.config.ts
M  frontend-next/package.json
M  frontend-next/src/app/(app)/layout.tsx
?? frontend-next/src/app/(app)/perfil/page.tsx
M  frontend-next/src/app/(auth)/page.tsx
?? frontend-next/src/app/(auth)/registro/page.tsx
?? frontend-next/src/app/(auth)/verificar/page.tsx
?? frontend-next/src/app/auth/[[...path]]/route.ts
?? frontend-next/src/app/web-api/auth/[action]/route.ts
?? frontend-next/src/app/web-api/perfil/route.ts
M  frontend-next/src/components/layout/UserMenu.tsx
M  frontend-next/src/config/navigation.ts
M  frontend-next/src/features/auth/AccessPlaceholder.tsx
?? frontend-next/src/features/auth/AuthField.tsx
?? frontend-next/src/features/auth/AuthFlowLinks.tsx
?? frontend-next/src/features/auth/AuthForm.tsx
?? frontend-next/src/features/auth/AuthScreen.tsx
?? frontend-next/src/features/auth/FormMessage.tsx
?? frontend-next/src/features/auth/SubmitButton.tsx
?? frontend-next/src/features/auth/VerificationForm.tsx
M  frontend-next/src/features/auth/auth.module.css
?? frontend-next/src/features/auth/client.ts
?? frontend-next/src/features/auth/contracts.ts
?? frontend-next/src/features/auth/useFormReady.ts
?? frontend-next/src/features/auth/validation.ts
?? frontend-next/src/features/perfil/ProfileView.tsx
?? frontend-next/src/features/perfil/contracts.ts
?? frontend-next/src/features/perfil/perfil.module.css
?? frontend-next/src/lib/auth/gateway.ts
?? frontend-next/src/lib/auth/server.ts
?? frontend-next/src/lib/perfil/server.ts
?? frontend-next/tests/auth-gateway.test.mjs
?? frontend-next/tests/auth-validation.test.mjs
?? frontend-next/tests/profile-browser.mjs
?? frontend-next/tests/profile.test.mjs
M  frontend-next/tests/proxy.test.mjs
?? migration-proposals/SCRUM-72/01-preflight.sql
?? migration-proposals/SCRUM-72/02-email-verification.sql
?? migration-proposals/SCRUM-72/03-postflight.sql
?? migration-proposals/SCRUM-72/04-recovery.md
?? migration-proposals/SCRUM-72/README.md
?? migration-proposals/SCRUM-72/tests/requirements.txt
?? migration-proposals/SCRUM-72/tests/run_disposable.py
?? migration-proposals/SCRUM-72/tests/test_consistency.py
?? tests/e2e/COMMIT-REVIEW.md
?? tests/e2e/README.md
?? tests/e2e/RESULTS.md
?? tests/e2e/backend_server.py
?? tests/e2e/browser.mjs
?? tests/e2e/network-guard.cjs
?? tests/e2e/requirements.txt
?? tests/e2e/run_e2e.py
```

## Antes de Pull Request o despliegue

- Revisar con Francisco y los consumidores los 401/404 del detalle del editor,
  429/503 de autenticación y 410 del antiguo passthrough web /auth.
- Aprobar cualquier ejecución SQL fuera del runner; verificar esquema/roles/RLS
  del entorno destinado a integración. No se inspeccionó Supabase real aquí.
- Repetir HTTPS con build/start y el reverse proxy definitivo. La prueba integral
  actual usa la excepción HTTP de loopback en desarrollo; Secure/host cookie
  tiene cobertura unitaria, no certificación de la infraestructura definitiva.
- Coordinar recuperación de cuentas antiguas sin Argon2, limitación de intentos
  de login a nivel de servicio y exposición de FastAPI solo según arquitectura
  aprobada. La activación productiva sigue deshabilitada.
- La edición del perfil pertenece a SCRUM-78 y no es requisito implementado aquí.

Los cambios están listos para **revisión humana del commit local**, no para afirmar
que la autenticación ya esté habilitada o certificada en producción.
