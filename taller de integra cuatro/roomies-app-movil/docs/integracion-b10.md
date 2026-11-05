# Revisión local de B10 — Sprint 2

Se prepara en `codex/integrar-b10-supabase`, partiendo de B10 (`0f80b45`) y
combinando la base del PR #29, `integracion-movil-sprint-2` (`8aa33b8`).
Esta revisión no publica cambios ni fusiona el PR de GitHub.

## Criterio de resolución

- Conservar desde la base el cliente y servicio Supabase, `useAuth`, login,
  registro, callback, restauración y protección de rutas.
- Conservar A07/A08: cliente HTTP con Bearer y multipart, consulta y adaptación
  del perfil propio. Conservar también la fecha de nacimiento y `CustomInput`.
- Conservar B03: ruta del perfil público y navegación desde `Usuario_Card`.
- Combinar el detalle asíncrono de B10 con el CTA por origen y la postulación
  autenticada de C10. Mantener Mis postulaciones de C11.
- Quitar la autenticación simulada que introducía la rama de búsqueda.
- Incorporar filtros de personas y estados vacíos de Javier. El buscador de
  arriendos utiliza el resultado del servicio; Inicio mantiene su uso compartido.
- Concentrar creación, listado y detalle en `publicacionesService.ts`, evitando
  el segundo servicio que introducía B10.

## Alcance real de las consultas

Listado y detalle conservan la fuente **demostrativa** que traía B10. No se han
conectado rutas nuevas ni añadido una autenticación alternativa. La creación de
publicaciones y las postulaciones conservan su cliente HTTP autenticado.

El adaptador orientativo de B07 entrega un resumen parcial: el DTO original no
incluye autor, origen, estado ni cupos totales. No se inventan esos campos para
hacerlo pasar por una publicación completa. Su conexión requiere contrastar el
contrato publicado de TI2. El filtro `habitaciones` tampoco tiene equivalente en
el modelo local y permanece pendiente.

Los avances de B08 que quedaron en otra rama y los de D10 no se fusionan aquí.

## Validación

- Se compararon con `8aa33b8` **24 archivos** de autenticación, perfil, cliente
  HTTP, navegación de B03 y servicios de postulaciones: idénticos a la base.
- `npm run lint -- --no-cache`: aprobado, sin advertencias.
- `npx tsc --noEmit`: aprobado.
- Pruebas HTTP, Perfil y publicaciones: **42 aprobadas**.
- `npx expo export --platform web --output-dir .expo/revision-b10-web`: aprobado;
  exporta 23 rutas, incluidas `/auth/callback`, `/usuario/[id]` y postulaciones.
- Las pruebas HTTP y de Perfil utilizan SDK y transporte controlados; no
  demuestran una conexión autenticada satisfactoria con el backend desplegado.
- Las pruebas de publicaciones comprueban listado/detalle, filtros, IDs,
  multipart y propagación del error de sesión al crear.

## Recorrido manual antes de publicar

1. Iniciar Expo con las variables locales existentes e iniciar sesión con una
   cuenta del Supabase común. No usar usuarios ni contraseñas de mocks.
2. Recargar o reabrir la app: la sesión debe restaurarse.
3. Abrir Perfil y usar Reintentar: debe consultar `/usuarios/me`; un fallo del
   backend debe mostrarse como error, sin sustituirlo por un perfil ficticio.
4. En Buscar, comprobar Arriendos/Personas, filtros, estados vacíos y navegación
   al perfil público. Listado y detalle siguen siendo demostrativos.
5. Comprobar creación y Mis postulaciones sin perder la sesión. Las pruebas
   contra el entorno común requieren que sus servicios estén operativos.
6. Cerrar sesión, reabrir la app y comprobar que no reaparece una sesión local.

Solo después de revisar el resultado local corresponde decidir cómo actualizar
la rama B10 del PR #29. Aquí no se modifica ninguna rama remota.
