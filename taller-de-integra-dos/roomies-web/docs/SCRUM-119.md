# S3R-E02 · Conectar Mi arriendo e integrantes

Implementación web preparada sobre `SCRUM-119`. La integración conserva a Convivencia como autoridad de permisos. Los handlers del Gateway reenvían el JWT de sesión y no sustituyen la respuesta upstream `403`, `404` o `503` por listas o capacidades locales.

## Cambios

- `GET /web-api/arriendos/mio` alimenta Mi arriendo y la lista de integrantes. Un `404` muestra ausencia de arriendo; una falla `503` o de red deja un error recuperable.
- `GET /web-api/arriendos/{id}` agrega la consulta autenticada del detalle. Valida IDs, estado y consistencia `integrantes_activos + cupos_disponibles = cupos_totales`; una respuesta incompleta/inconsistente se convierte en `503`.
- `GET /web-api/arriendos/{id}/integrantes` usa cursor y el filtro `activos`; limita el DTO público y no devuelve campos adicionales del servicio. El selector de integrantes consulta `activos=true` y permite continuar con el cursor recibido.
- Mis publicaciones enlaza al arriendo asociado cuando la API entrega `id_arriendo`. La vista por ID muestra capacidad e integrantes y solo incluye navegación a integrantes.
- Chat y tareas verifican desde Server Components que `/api/arriendos/mio` confirme pertenencia activa antes de renderizar sus vistas. La autorización continúa validándose en cada operación por el servicio.

## Validación local

Entorno: Windows/PowerShell, Node `v24.20.0`, Next.js `16.4.3`, rama `SCRUM-119`.

```text
node node_modules/next/dist/bin/next typegen
# exit 0 — route types generados
node node_modules/typescript/bin/tsc --noEmit
# exit 0
node node_modules/eslint/bin/eslint.js .
# exit 0
git diff --check
# exit 0; solo avisos de normalización LF/CRLF en cuatro archivos
```

SHA `HEAD` base: `fdf4fea58752d44cec432951e175cc71cd954f36`. Los cambios están sin commit, así que ese SHA no identifica esta implementación. Jira: `S3R-E02` (no se proporcionó URL). PR: pendiente.

## Estado de aceptación

La validación estática terminó. No se acredita el recorrido con un servicio real de Convivencia ni la evidencia de ejecución para usuario ajeno, dueño, administrador y `503`. La matriz de Sprint 3 del repositorio documenta que ese servicio/Gateway sigue pendiente en el SHA revisado; por eso no se declara cumplido el requisito completo. Para cerrar la aceptación, desplegar el contrato de Convivencia, ejecutar esos casos con cuentas de prueba y adjuntar resultados sanitizados junto al SHA de commit y el enlace PR/Jira.
