# Evidencia visual S3R-E03

Última comprobación en destino: [Supabase real y bloqueo de despliegue en Kubero](2026-11-26-hosted/README.md). Dos cuentas autenticadas correctamente; aceptación del chat pendiente por servicios ausentes/HTTP 503.

Estado actual: [validación integrada del 26/11](validacion-2026-11-26.md), con navegador, BFF, Gateway, servicios y PostgreSQL reales locales. Usa una fixture explícita de identidad. Las capturas nuevas están en [2026-11-26-local](2026-11-26-local/). El contenido restante conserva el ensayo visual anterior.

## Vista local

`chat-demo-local.png` muestra la vista web actual en `/mi-arriendo/chat`, con mensajes de muestra servidos por una API sintética local. La conversación adapta el patrón de burbujas, compositor inferior, contenedores redondeados y colores violeta de `n_m_chat_convivencia_04.png`; la pantalla web `n_w_chat_convivencia_02.png` es el dashboard del arriendo, no una pantalla de conversación.

La captura sirve para revisar presentación y flujo visual. Los nombres y mensajes son ficticios; el POST del servidor sintético no persiste datos y esta captura no demuestra aceptación de persistencia entre dos integrantes.

## Entorno

- Windows / PowerShell; Node `v24.20.0`; Next.js `16.4.3`.
- Aplicación: `http://127.0.0.1:3117/mi-arriendo/chat`.
- API de demostración local: `http://127.0.0.1:3118`; perfil, arriendo y mensajes de fixture. No usa cuentas, datos reales, base de datos ni servicios externos.
- Esta aplicación Next.js se ejecuta con Node/npm; el `.venv` de Python no interviene.
- Captura sanitizada; SHA-256 `16FE8DF907EF8A35B79171AEC0BDAC37205B198548F6AF67480B20B3E650FEBC`.

## Comprobaciones

```text
node.exe node_modules/typescript/bin/tsc --noEmit
  Exit code 0

node.exe node_modules/eslint/bin/eslint.js src/features/recorrido/ChatPreviewPage.tsx
  Exit code 0, sin advertencias

python -I -B backend/services/convivencia-mensajeria-service/tests/run_offline.py
  41 passed; 1 advertencia deprecada de Starlette TestClient/httpx

python -I -B backend/api-gateway/tests/run_isolated.py backend/api-gateway/tests/test_convivencia_routes.py
  151 passed

git diff --check
  Exit code 0; Git solo informó conversión LF/CRLF en ChatPreviewPage.tsx

GET /web-api/arriendos/mio, GET /web-api/conversaciones,
GET /web-api/auth/sesion, GET /web-api/conversaciones/7/mensajes?limite=20
  HTTP 200 en desarrollo local con API sintética
```

El bloqueo histórico por ausencia de `pg_ctl`/`initdb` ya fue superado en el ensayo del 26/11. La aceptación final con Supabase real y PostgreSQL Kubero sigue pendiente; ver [SCRUM-120](../../SCRUM-120.md).
