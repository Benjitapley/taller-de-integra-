# SCRUM-117: interfaces del recorrido y sus estados

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

No se realizó commit, push, merge ni modificación de Jira.
