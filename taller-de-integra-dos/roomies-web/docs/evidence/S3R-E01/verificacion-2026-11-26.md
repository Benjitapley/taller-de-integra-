# Verificación local de S3R-E01 · 26/11/2026

## Verificación posterior al parche 16.4.6

Se actualizaron `next`, `eslint-config-next` y sus paquetes internos a 16.4.6,
con versiones exactas y lockfile consistente. React y las demás versiones de la
aplicación se conservaron. `npm ls next eslint-config-next --depth=0` confirma
ambos paquetes instalados en 16.4.6.

| Comando posterior al parche | Resultado |
| --- | --- |
| `npm run lint` | Correcto, salida 0 |
| `npm run typecheck` | Correcto, salida 0 |
| `npm test` con todas las rutas de navegador configuradas | 157 aprobadas, 0 fallidas, 0 omitidas; salida 0 |
| `npm run build` | Correcto con Next.js 16.4.6, salida 0 |

Se configuró `REPORTS_PLAYWRIGHT_PATH` con la misma ruta de Playwright usada en
`PROFILE_PLAYWRIGHT_PATH`, además de ambos paths de Chromium y
`PUBLICATIONS_BROWSER_TESTS=1`. Esto activa las tres suites antes omitidas de
reportes/admin/listas privadas. Son pruebas locales con HTTP sintético; no se
reportan como pruebas reales de PostgreSQL o Storage.

Al habilitar la suite opcional de reportes se detectó un fixture antiguo de
integrantes sin `activo`, `es_responsable` ni `fecha_ingreso`. Se completó el
fixture con esos campos del contrato; la validación del BFF no se modificó.
La ejecución dirigida de esa suite pasó antes de repetir la suite completa.

Activación adicional respecto de la reproducción histórica de abajo:

```powershell
$env:REPORTS_PLAYWRIGHT_PATH = $env:PROFILE_PLAYWRIGHT_PATH
```

Definir las rutas de navegador antes de ejecutar `npm test`. El script serializa
las suites para evitar competir por recursos de compilación de Next.

La suite completa terminó en 270133 ms. El build compiló y generó las rutas sin
la alerta de seguridad anterior; conserva únicamente el aviso informativo por
múltiples lockfiles. Se revisaron el diff y los archivos de evidencia: no se
incluyen archivos de entorno, credenciales reales, cachés ni directorios temporales.
Las capturas de `ui/` se regeneraron en esta corrida con datos sintéticos.

Salidas del parche: [lint](next-16.4.6-lint.txt),
[TypeScript](next-16.4.6-typecheck.txt), [tests](next-16.4.6-tests.txt)
y [build](next-16.4.6-build.txt).

`npm audit --json` ya no incluye `next` entre los paquetes vulnerables. Reporta
7 vulnerabilidades moderadas en la cadena de desarrollo `typescript-eslint` /
`minimatch`; 0 altas y 0 críticas. No se ejecutó un `npm audit fix` general ni se
presenta el parche como una auditoría de seguridad completa.

La [auditoría real](../../qa/S3R-E01-aceptacion-real.md) documenta el bloqueo por
configuración ausente. No hay una corrida autenticada contra 5432, Gateway o
Storage compartidos, ni un reinicio real que acreditar. El SHA del commit de la
entrega se obtiene de la rama `SCRUM-118`; el SHA desplegado sigue pendiente.

## Registro histórico anterior al parche

Directorio de comandos: `taller-de-integra-dos/roomies-web/frontend-next`.
Base de esta revisión: `0a0a7acd99827e8a87e27a411a7a2d9f35eeb634`.
Al registrar esta corrida anterior al parche, los cambios estaban en el árbol
de trabajo y no había commit ni PR del candidato.

Huella SHA-256 del contenido de los 29 archivos cambiados/nuevos del frontend:
`e6cbe72664706ec3994c8f7e8ed24cf482745d01c43998597a9869abdd57ed9f`.
Se calcula con nombres relativos y bytes, en orden lexicográfico, separados por
NUL; incluye archivos nuevos y excluye documentación y artefactos ignorados.
Esta huella no sustituye el SHA de un commit integrado.

## Resultados

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Correcto, salida 0 |
| `npm run typecheck` | Correcto, salida 0 |
| `npm test` con `PUBLICATIONS_BROWSER_TESTS=1` | 154 aprobadas, 0 fallidas, 3 opcionales de otras tareas omitidas; salida 0 |
| `npm run build` | Correcto en la repetición, salida 0; conserva advertencia de seguridad de Next.js |
| `git diff --check` | Sin errores al revisar los cambios |

Entorno: Windows, Node `v24.20.0`, Chromium local `chromium-1255`, headless. Los tests levantan Next
en copias temporales y usan dobles HTTP. La suite de publicaciones comprueba las
solicitudes del navegador y el transporte del BFF por separado; ninguna usa
Supabase remoto. El build usa Next 16.4.3. La advertencia de múltiples lockfiles
es informativa.

El primer build final generó las rutas, pero terminó con `SecurityFatalError`
de Next.js 16.4.3. La repetición solicitada por el propio comando terminó con
salida 0 y mantuvo el aviso de vulnerabilidad conocida. Next recomienda actualizar
la dependencia; esa actualización sigue pendiente y no se presenta el build como
una validación de seguridad. No se modificaron dependencias en esta revisión.

## Reproducción

```powershell
npm.cmd run lint
npm.cmd run typecheck
$env:REPORTS_BROWSER_PATH = 'C:/Users/gabri/AppData/Local/ms-playwright/chromium-1255/chrome-win64/chrome.exe'
$env:PUBLICATIONS_BROWSER_TESTS = '1'
$env:PROFILE_PLAYWRIGHT_PATH = 'C:/Users/gabri/AppData/Roaming/Python/Python314/site-packages/playwright/driver/package'
$env:PROFILE_BROWSER_PATH = $env:REPORTS_BROWSER_PATH
$env:PUBLICATIONS_QA_DIR = '../docs/evidence/S3R-E01/ui'
npm.cmd test
npm.cmd run build
```

En otra máquina se puede apuntar `REPORTS_BROWSER_PATH` y `PROFILE_BROWSER_PATH`
al Chromium instalado para Playwright. Las pruebas E01 fallan si falta el navegador;
no se sustituyen por una omisión silenciosa. Las suites opcionales de otras tareas
mantienen sus variables de activación independientes.

## Cobertura y capturas

- Precio entero, extremos de CLP y rechazo de fracciones/negativos/exceso.
- Enumeraciones y campos exactos del contrato; rechazo de campos heredados.
- DTO, región/comuna/autor, IDs y archivos conservados, límites de cinco imágenes.
- Envelope canónico en crear/editar/listar/leer/cerrar, con detalles por campo.
- Multipart con boundary generado por fetch, sin convertir archivos a JSON.
- Tres páginas de catálogo, fallo de página siguiente, reintento y reinicio al filtrar.
- 409/422/503 y pérdida de red: textos, archivos, IDs e Idempotency-Key conservados.
- Edición recuperable, confirmación/cancelación de cierre, respuesta canónica y recarga.
- Navegador sin errores de ejecución de React.

Capturas de la UI local con datos sintéticos:
[catálogo](ui/catalogo.png), [formulario tras error recuperable](ui/crear-error-recuperable.png)
y [detalle](ui/detalle.png). Las imágenes son generadas por el fixture HTTP;
no acreditan fotos del equipo ni persistencia de Storage.
El resultado completo está en [frontend-tests-2026-11-26.txt](frontend-tests-2026-11-26.txt).
También se conservan [lint](frontend-lint-2026-11-26.txt),
[TypeScript](frontend-typecheck-2026-11-26.txt) y [build](frontend-build-2026-11-26.txt).

La evidencia SQL anterior [postgres.txt](postgres.txt) registra 67 pruebas
aprobadas con PostgreSQL temporal. No se reejecutó en esta revisión de frontend.

## Aceptación externa pendiente

El [acta TI4](../../contracts/S3R-E01-TI4.md) especifica datos de entorno,
responsables, Gateway compartido, SHA/build, PR y fotos reales por completar.
Se requiere crear/buscar/editar/cerrar con Listado y Storage reales, verificar otra
sesión y reinicio de servicios y completar el recorrido cruzado con TI4.
Los ejemplos de ese documento están identificados como fixtures reproducibles.
**El cierre de aceptación de E01 no se atribuye a estas pruebas locales.**
