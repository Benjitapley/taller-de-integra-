# Evidencia de revisión S3R-E00

Capturas obtenidas el 23/11/2026 desde la app web en `NODE_ENV=development`. El capturador levanta Next.js y un Gateway local de respuesta sintética, usa un token de sesión ficticio y no consulta datos reales. Los selectores E00 indican en pantalla que fixtures y mensajes son locales. No se guardan contraseñas, tokens reales ni datos personales.

| Archivo | Estado visible |
|---|---|
| `01-mi-arriendo-sin-arriendo.png` | Sin arriendo activo (preview 404) |
| `02-mi-arriendo-cargando.png` | Carga de Mi arriendo |
| `03-mi-arriendo-error-reintentable.png` | Error recuperable y botón Reintentar |
| `04-chat-activo.png` | Conversación con mensajes de muestra |
| `05-chat-error-reintentable.png` | Error recuperable de chat |
| `06-chat-acceso-retirado-403.png` | Mensaje de acceso retirado |
| `07-integrantes-separados-de-postulantes.png` | Arrendador e integrantes separados; postulantes enlazados a Mis publicaciones |
| `08-tarea-formulario-sin-asignado.png` | Modal de nueva tarea con «Sin asignar» |

Para regenerarlas, desde la raíz del repositorio:

```powershell
node taller-de-integra-dos/roomies-web/docs/evidence/E00/capture-e00.mjs
```

El script usa Microsoft Edge instalado en Windows y el puerto local; no despliega servicios ni escribe en Jira. Resultado: 8 PNG generados y cada estado se comprobó en el DOM antes de guardar. La confirmación de etiquetas/errores por TI4 sigue pendiente y no se infiere de estas capturas.

Validación ejecutada en `taller-de-integra-dos/roomies-web/frontend-next`:

```text
node node_modules/next/dist/bin/next typegen
  Types generated successfully
node node_modules/typescript/bin/tsc --noEmit
  Exit code 0
node node_modules/eslint/bin/eslint.js <cinco archivos TypeScript modificados>
  Exit code 0
```

Desde la raíz del repositorio:

```text
git diff --check
  Sin errores de whitespace
```