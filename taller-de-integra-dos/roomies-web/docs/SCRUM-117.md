# SCRUM-117: interfaces del recorrido y sus estados

> **Actualización S3R-E00 (22/11/2026):** se completó la preparación revisable de
> las vistas de convivencia. Esta actualización no acredita conexión con el
> backend ni aprobación de TI4. Responsable: Gabriel Yamaguchi. Véase
> [Evidencia y límites](#evidencia-y-lmites).

## Alcance

Se preparó la interfaz web necesaria para representar el recorrido posterior a
una postulación, sin ampliar el alcance funcional del Sprint 3.

La entrega incorpora:

- Estados visuales reutilizables para postulaciones, arriendos y tareas.
- La confirmación visual de una postulación aceptada.
- El acceso desde una postulación aceptada a la pantalla «Mi arriendo».
- Una ruta privada «Mi arriendo» para consultar el estado del arriendo activo.
- Un adaptador Next.js para consultar `GET /api/arriendos/mio` a través del BFF.
- El enlace «Mi arriendo» en la navegación lateral.

No se implementaron conexiones reales con chat, integrantes, tareas, retiro,
expulsiones, reportes ni operaciones de escritura. Los controles de «Ver
integrantes», «Abrir chat» y «Ver tareas» permanecen deshabilitados hasta que
SCRUM-124, SCRUM-125 y las historias correspondientes estén disponibles.

## Estados de postulación

Se agregaron los cinco estados compartidos del contrato:

- Pendiente.
- Preseleccionada.
- Aceptada.
- Rechazada.
- Cancelada.

El componente [JourneyStatus.tsx](../frontend-next/src/features/recorrido/JourneyStatus.tsx)
muestra cada estado con una etiqueta de color y evita tratar una aceptación como
pendiente de incorporación. Cuando el backend entrega `id_arriendo`, la tarjeta
de una postulación aceptada muestra el enlace a «Mi arriendo».

La normalización del adaptador conservó `id_arriendo` en las respuestas de
postulación para que la interfaz pueda activar ese enlace únicamente cuando la
incorporación ya quedó registrada.

## Pantalla «Mi arriendo»

La página [mi-arriendo/page.tsx](../frontend-next/src/app/(app)/mi-arriendo/page.tsx)
presenta estos casos:

- Carga en curso.
- Error recuperable con botón «Reintentar».
- Sin arriendo activo.
- Arriendo activo o finalizado.
- Capacidad total, integrantes activos y cupos disponibles.

La pantalla no inventa datos. Si el backend responde `404`, muestra que todavía
no existe un arriendo activo. Los errores `401`, `403`, `404` y `503` se
gestionan en el adaptador sin devolver estructuras vacías falsas.

El endpoint interno del BFF es
`GET /web-api/arriendos/mio`. Reenvía el JWT de la cookie HttpOnly al endpoint
público `GET /api/arriendos/mio` y valida que la respuesta contenga identificadores
y capacidades numéricas válidas.

## Estados de arriendo y tarea

La preparación reutilizable incluye:

- Arriendo activo.
- Arriendo finalizado.
- Tarea pendiente.
- Tarea completada.

Estos componentes pueden usarse en las pantallas posteriores sin duplicar
colores o convenciones de presentación.

## Archivos agregados

- `frontend-next/src/features/recorrido/types.ts`
- `frontend-next/src/features/recorrido/JourneyStatus.tsx`
- `frontend-next/src/features/recorrido/recorrido.module.css`
- `frontend-next/src/app/(app)/mi-arriendo/page.tsx`
- `frontend-next/src/app/web-api/arriendos/mio/route.ts`
- `frontend-next/src/lib/recorrido/server.ts`
- `docs/SCRUM-117.md`

## Archivos modificados

- `frontend-next/src/features/publicaciones/Applications.tsx`
- `frontend-next/src/lib/publicaciones/applications.ts`
- `frontend-next/src/config/navigation.ts`
- `frontend-next/src/app/globals.css`

## Validación

Se ejecutó la generación de tipos de rutas y TypeScript directamente con los
ejecutables locales de Next.js y TypeScript:

```text
next typegen
tsc --noEmit
```

Resultado: rutas generadas correctamente y TypeScript sin errores.

El comando `npm run typecheck` no pudo ejecutarse mediante el wrapper de npm
porque el entorno tiene una ruta Python ausente en el ejecutable configurado.
La misma validación se completó directamente con `next typegen` y `tsc --noEmit`.

## Pendientes

- Conectar «Ver integrantes» con `GET /api/arriendos/{id}/integrantes`.
- Conectar «Abrir chat» con las rutas de conversaciones de convivencia.
- Conectar «Ver tareas» con `GET /api/arriendos/{id}/tareas`.
- Incorporar acceso a retiro y expulsiones solo a los actores autorizados.
- Implementar estados de carga y error para las nuevas operaciones reales.

## Actualización S3R-E00: vistas preparadas

La referencia de producto fue la galería `Roomies_mockups_TI4_COMPLETO` (33
pantallas), en particular `n_w_chat_convivencia_02.png`, `w_tarea.png` y
`w_detalle_arriendo.png`. Se prepararon rutas privadas bajo `/mi-arriendo` para
integrantes, chat y tareas. La navegación global lleva a Chat; las tareas y los
integrantes se alcanzan desde Mi arriendo. No se agregaron pantallas excluidas
al menú. Favoritos, Mis conexiones y la pestaña Personas del catálogo siguen
disponibles.

Mi arriendo ofrece accesos en tarjetas a Chat del arriendo y Organización de la
casa, siguiendo el dashboard web. “Nueva tarea” se abre como diálogo accesible,
siguiendo `w_tarea.png`; en revisión de desarrollo permite crear tareas locales
sin asignado. No se agregaron recordatorios ni documentos compartidos porque no
están en el alcance del contrato S3 de esta historia.

`features/recorrido/types.ts` documenta los DTO de integrante, conversación,
mensaje y tarea conforme a Contrato S3 §2.4. No se inventan DTO para postulantes:
se consultan aparte en Mis publicaciones. La interfaz diferencia responsable
del arriendo e integrantes residentes. El formulario de tarea permite dejar
`id_asignado` en `null` (Sin asignar). El estado 403 comunica retirada de acceso
y revocación de chat/tareas según contrato. Errores ofrecen Reintentar y carga,
ausencia de datos y contenido usan estados textuales accesibles.

La vista ficticia `/recorrido-preview` se retiró en la limpieza de `dev-web`.
Se conservan las pantallas de integrantes, chat y tareas. Estas indican
explícitamente que las APIs de convivencia no están conectadas y mantienen los
controles de escritura deshabilitados hasta conectar el servicio.

### Evidencia y límites

- Contrato cotejado: `docs/contracts/SCRUM-99-contrato-alcance-S3-v1.4.md`, §2.4.
- Mockups cotejados: `n_w_chat_convivencia_02.png`, `w_tarea.png` y
  `w_detalle_arriendo.png` de la galería entregada por el usuario.
- Accesibilidad revisada en código: jerarquía de encabezados, labels explícitos,
  botones con nombres, `role=status/alert/log`, `aria-live`, foco visible global,
  navegación por enlaces y objetivos de al menos 44 px para acciones.
- PR/Jira: no se creó ni actualizó un enlace externo en esta sesión.
- Referencia anterior visible en la evidencia entregada: [PR #51](https://github.com/Benjitapley/taller-de-integra-/pull/51), ya fusionada; no contiene esta actualización local. Jira: sin URL/clave proporcionada.
- SHA de HEAD antes de estos cambios: `6964700b2260956a3a9fcc894d6fbcf54f3b6a8a`.
  La entrega permanece en el árbol de trabajo sin commit; no se presenta ese SHA
  como SHA de los cambios.
- Entorno: Windows, PowerShell, Node v24.20.0, Next.js 16.4.3; fecha 22/11/2026.

Comandos de validación de esta actualización (ejecutables locales para evitar
el bloqueo de PowerShell al iniciar `npm.ps1`):

```text
node node_modules/next/dist/bin/next typegen
# ✓ Generating route types; Types generated successfully
node node_modules/typescript/bin/tsc --noEmit
# ✓ Exit code 0
node node_modules/eslint/bin/eslint.js .
# ✓ Exit code 0, sin errores ni advertencias
git diff --check
# ✓ Exit code 0, sin errores de whitespace
```

No se realizó commit, push, merge ni modificación de Jira.
