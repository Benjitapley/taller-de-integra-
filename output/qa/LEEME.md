# Pruebas de endpoints, permisos y Swagger

Resultados de la revisión del producto en el commit `63b8493`, el 1 de noviembre
de 2026. No se modificó la lógica de la aplicación. Los datos de usuario y
publicaciones utilizados son ficticios.

## Resultados

| Comprobación | Total | PASS | FAIL | INFO |
| --- | ---: | ---: | ---: | ---: |
| Suite Python existente | 53 | 53 | 0 | 0 |
| Permisos y cierre de sesión | 55 | 40 | 15 | 0 |
| Contratos y robustez | 29 | 20 | 9 | 0 |
| Swagger/OpenAPI | 28 | 20 | 6 | 2 |
| HTTP local y CDN de documentación | 11 | 11 | 0 | 0 |

La suite JavaScript existente también pasó. Los resultados adicionales son
123 comprobaciones: 91 PASS, 30 FAIL y 2 INFO. Varias comprobaciones detectan
la misma causa; no equivalen a 30 vulnerabilidades distintas.

**Los FAIL no se ocultaron ni se cambiaron las expectativas para hacerlos pasar.**
Las comprobaciones de permisos exigen rechazar operaciones privadas sin sesión
verificada. Las de robustez incluyen validaciones recomendadas, como rechazar
una foto de perfil inválida o demasiado grande. La implementación actual aún
no cumple todas estas expectativas.

## Repetir desde la raíz del repositorio

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
node tests/test_publicaciones_ui.cjs
.\.venv\Scripts\python.exe -B scripts/verificar_permisos_publicaciones.py
.\.venv\Scripts\python.exe -B scripts/verificar_contratos_publicaciones.py
.\.venv\Scripts\python.exe -B scripts/verificar_swagger_publicaciones.py
.\.venv\Scripts\python.exe -B scripts/verificar_http_swagger.py
```

Los tres primeros scripts nuevos devuelven código de salida **1** mientras
existan FAIL. Es una señal intencional de criterios incumplidos, no un fallo
del generador del informe. El verificador HTTP devuelve 1 si falla una
comprobación o no puede comprobar un recurso externo.

Se necesitan las dependencias de `main/requirements.txt`; para la suite
JavaScript se necesita Node.js. Los scripts nuevos bloquean `psycopg.connect`
y sustituyen `load_dotenv`: no usan la base ni las credenciales de `.env`.
El script HTTP abre un puerto temporal solo en `127.0.0.1`, desactiva el
`lifespan`, detiene el servidor al acabar y consulta tres recursos públicos
del CDN de Swagger/ReDoc sin ejecutar su JavaScript.

## Evidencias

- `resumen.json`: resultados consolidados y límites.
- `permisos.json`: los 55 casos y sus respuestas, incluidos los pasos de logout.
- `contratos.json`: los 29 casos, datos esperados y obtenidos.
- `swagger.json`: los 28 criterios de documentación.
- `openapi_auditado.json`: esquema de publicaciones/auth que se auditó; se aisló el router de conexiones.
- `http_swagger.json`: HTTP real local y disponibilidad de los recursos del CDN.
- `unittest_log.txt`: ejecución de las 53 pruebas existentes.

Los JSON se actualizan al repetir sus scripts. El PDF es una fotografía de
esta revisión; volver a ejecutar los scripts no lo regenera automáticamente.

No se realizaron pruebas de persistencia sobre PostgreSQL real ni pruebas
visuales o interactivas de Swagger en navegador. Un HTML 200 y sus assets
accesibles no demuestran que todos los controles de `Try it out` funcionen.
