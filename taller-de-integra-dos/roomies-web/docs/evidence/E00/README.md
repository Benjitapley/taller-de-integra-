# Evidencia de revisión S3R-E00

Capturas generadas el 24/11/2026 desde el commit `946f9a8a9b6159ed8faeb09248ad73a19ad89b0a` en `NODE_ENV=development`. El capturador levantó Next.js y un Gateway local de respuesta sintética, usó un token ficticio y no consultó datos reales. Los selectores E00 indican en pantalla que fixtures y mensajes son locales. No se guardan contraseñas, tokens reales ni datos personales. Las rutas de integrantes y chat cambiaron posteriormente al integrar E02/E03 desde `dev-web`; estas capturas documentan la revisión E00 anterior.

| Archivo | Estado visible |
|---|---|
| `01-mi-arriendo-sin-arriendo.png` | Sin arriendo activo (preview 404) |
| `02-mi-arriendo-cargando.png` | Carga de Mi arriendo |
| `03-mi-arriendo-error-reintentable.png` | Error recuperable y botón Reintentar |
| `04-chat-activo.png` | Conversación con mensajes de muestra |
| `05-chat-error-reintentable.png` | Error recuperable de chat |
| `06-chat-acceso-retirado-403.png` | Mensaje de acceso retirado |
| `07-integrantes-separados-de-postulantes.png` | Responsable residente y otros integrantes; arrendador y postulantes remitidos a Mis publicaciones |
| `08-tarea-formulario-sin-asignado.png` | Modal de nueva tarea con «Sin asignar» |
| `09-mi-arriendo-activo.png` | Dashboard activo con tarjetas de chat, tareas y datos del grupo |

El siguiente comando reproduce las capturas en el commit indicado, desde la raíz del repositorio. El script ya no reproduce esos estados sobre las rutas integradas actuales:

```powershell
node taller-de-integra-dos/roomies-web/docs/evidence/E00/capture-e00.mjs
```

El script usa Microsoft Edge instalado en Windows y el puerto local; no despliega servicios ni escribe en Jira. Resultado final: 9 PNG regenerados; código de salida 0. Los estados visibles se comprobaron en el DOM, al igual que el retorno de «Reintentar» en Mi arriendo y chat, el foco inicial, las etiquetas y el valor «Sin asignar» del modal, el cierre con Escape y la ausencia de «Nueva tarea» tras retirar el acceso. La confirmación de etiquetas/errores por TI4 sigue pendiente y no se infiere de estas capturas.

Validación ejecutada en `taller-de-integra-dos/roomies-web/frontend-next`:

```text
node node_modules/next/dist/bin/next typegen
  Types generated successfully
node node_modules/typescript/bin/tsc --noEmit
  Exit code 0
node node_modules/eslint/bin/eslint.js <ocho archivos TypeScript modificados>
  Exit code 0
```

Desde la raíz del repositorio:

```text
git diff --check
  Sin errores de whitespace
```

La ejecución de Next.js regeneró `.next/dev/types/validator.ts`, que antes apuntaba a rutas borradas; luego `tsc --noEmit` pasó con la configuración normal.

SHA de esta revisión: `946f9a8a9b6159ed8faeb09248ad73a19ad89b0a`. Entorno: Windows, Node.js 24.20.0, Next.js 16.4.3, Edge local, `NODE_ENV=development`. Enlace PR/Jira y aprobación de TI4: pendientes.
