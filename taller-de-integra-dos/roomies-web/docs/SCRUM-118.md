# S3R-E01 · Conectar catálogo y formularios al DTO y cursor

## Estado de evidencia

Implementación local preparada sobre `dev-web`. Este registro no declara cerrada
la aceptación completa de E01: faltan las verificaciones contra el entorno/API
compartidos y las pruebas manuales con imágenes reales indicadas al final.

## Cambios de UI de esta entrega

- La creación ofrece únicamente `Arrendador` y valida el payload como tal.
- El formulario elimina `cupos_min` y `cupos_disponibles`; la capacidad enviada es
  `cupos_totales` y el catálogo filtra por igualdad mediante `cupos_disponibles`.
- El BFF conserva y devuelve el DTO canónico de la respuesta de Listado al crear y
  editar, filtrando campos fuera del contrato.
- El selector de imágenes permite acumular archivos, ver nombre/tamaño y
  previsualización, retirar una selección individual y conservar/quitar imágenes
  remotas mediante sus IDs. Una respuesta fallida deja la selección del formulario
  disponible para corregir o reintentar.

El catálogo con cursor, carga de más, filtros exactos, selector de La Araucanía,
validación CLP y envío multipart ya estaban implementados en la base C02; su
descripción y pruebas anteriores constan en [S3R-C02](S3R-C02.md). No se usan esos
resultados como evidencia de API compartida.

## Verificación local ejecutada

Directorio: `taller-de-integra-dos/roomies-web/frontend-next`.

| Comando | Resultado | Alcance |
| --- | --- | --- |
| `node.exe --test tests/publications.test.mjs` | 18 aprobadas, 0 fallidas | BFF, DTO, cursor, validación CLP y límites multipart con fixtures locales. |
| `$env:PUBLICATIONS_BROWSER_TESTS='1'; $env:PROFILE_PLAYWRIGHT_PATH='C:/Users/gabri/AppData/Roaming/Python/Python314/site-packages/playwright/driver/package'; $env:PROFILE_BROWSER_PATH='C:/Users/gabri/AppData/Local/ms-playwright/chromium-1255/chrome-win64/chrome.exe'; node.exe --test tests/proxy.test.mjs` | 13 aprobadas, 0 fallidas | Navegador Chromium headless y Gateway sintético; incluye selector de región/comunas, fallos 503/reintento, región/comuna enviadas y edición. No contacta Listado real. |
| `node.exe node_modules/eslint/bin/eslint.js src/features/publicaciones/PublicationForm.tsx src/features/publicaciones/ImageFields.tsx src/lib/publicaciones/server.ts tests/publications.test.mjs` | Correcto | Lint de archivos modificados. |
| `node.exe node_modules/typescript/bin/tsc --noEmit` | Correcto | TypeScript del frontend. |
| `git diff --check` | Correcto | Sin errores de whitespace. |
| `.venv/Scripts/python.exe -I -B backend/local_stack/run_unit.py listado` | 40 aprobadas | Pruebas unitarias de Listado. |
| `.venv/Scripts/python.exe -I -B backend/services/listado-applications-service/tests/run_isolated.py` | No ejecutadas: no se encontró `initdb` / PostgreSQL local | El runner abortó antes de crear el clúster temporal; no es un fallo de las pruebas ni se contactó una BD externa. |

Entorno: Windows, Node `v24.20.0`, Playwright `1.65.1` del entorno Python y
Chromium `chromium-1255`, headless. No se consultó API ni Storage real; las pruebas
de Node y navegador usan dobles HTTP controlados. Se creó `.venv` con Python
`3.14.7` y se instalaron las dependencias fijadas de Listado desde
`backend/services/listado-applications-service/requirements.txt`, más pytest
`9.2.0`. No se encontró PostgreSQL local ni Docker para las pruebas SQL de
persistencia/reinicio.

## Identificación del candidato local

- HEAD/base del workspace: `fb309efabe9ac0103311ce86b723356ec1ca2f3e`.
- SHA-256 del diff binario de los archivos versionados modificados al registrar esta evidencia:
  `8d2afd98d42f5dc71dce67bd48b4fc0edf907a269042eae8b7d60dd0719908c2`.
- No hay commit, PR ni enlace Jira asociado a este candidato; no se inventa uno.

## Evidencia de aceptación todavía necesaria

1. En entorno compartido, crear, buscar, editar y cerrar un aviso Arrendador y
   revisar la respuesta canónica. Adjuntar comandos/resultados sanitizados,
   entorno y SHA del commit integrado.
2. Verificar más de dos páginas, filtro vacío, cambio de filtro con cursor nuevo,
   búsqueda de exactamente 2 cupos excluyendo avisos de 1 y 3, comuna inválida y
   respuesta 409 al cambiar capacidad.
3. Con imágenes reales del equipo, crear un aviso, editar conservando una foto,
   agregando otra y quitando otra; repetir la consulta en otro navegador y tras
   reiniciar/redeploy. Comprobar recuperación ante error de carga y fallo de red.
4. Adjuntar enlace real a PR/Jira y resultados sanitizados. Las pruebas locales no
   demuestran persistencia de Storage ni integración entre servicios. La corrida
   de navegador cubre ubicación y reintento de creación con 503; no prueba el flujo
   de edición de imágenes reales.
