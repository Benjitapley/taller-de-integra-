# Ubicación única de Roomies Web

La ubicación de TI2 es `taller-de-integra-dos/roomies-web`. El frontend está en
`taller-de-integra-dos/roomies-web/frontend-next`; los servicios y Docker Compose
se ejecutan desde la raíz de Roomies Web.

## Reconciliación de las copias de main

Se compararon las dos carpetas de `main` en
`21cf7c2ec56964aebfcae659baf72e1ee827a512` antes de consolidarlas:

- `taller de integra dos/roomies-web`: 343 archivos.
- `taller-de-integra-dos/roomies-web`: 322 archivos.
- Compartían 277 archivos idénticos y 33 con diferencias.
- Se conservaron los 355 archivos distintos por ruta relativa de ambas copias.

Se mantuvieron los contratos, validaciones, aliases, correcciones de registro y
perfil y el servicio base de Convivencia de la copia con espacios. Se incorporaron
los archivos exclusivos, pantallas, etiquetas de estado, navegación y documentación
de SCRUM-117 de la copia con guiones. No se restauraron las versiones anteriores
de autenticación que perdían la reutilización del comprobante PKCE o la validación
de la respuesta de inicialización de perfil.

Las postulaciones conservan `id_arriendo` y `incorporacion_pendiente`. La interfaz
solo anuncia la incorporación confirmada cuando recibe un arriendo válido y la
API indica que ya no está pendiente. Las consultas GET de arriendos se dirigen al
servicio configurado en `CONVIVENCIA_UPSTREAM_URL`; esto no implementa la aceptación
de SCRUM-107 ni demuestra que ese servicio esté desplegado.

La consolidación mantiene íntegro el árbol de `taller de integra cuatro` de main.
No incluye migraciones de base de datos ni cambios en Supabase o Render.

## Desarrollo y despliegue

Las referencias ejecutables y los enlaces de TI2 usan la ruta con guiones.
`node_modules`, archivos locales de entorno y otros archivos ignorados se conservan
localmente; no forman parte del commit. `next-env.d.ts` se genera con Next.js y no
debe recrear una segunda raíz de TI2.

La raíz esperada en Vercel es
`taller-de-integra-dos/roomies-web/frontend-next`. Esta reorganización no modifica
el panel de Vercel: el propietario debe comprobar que su Root Directory coincida.

Cada rama conserva sus propios avances. Compartir la ubicación del proyecto no
fusiona automáticamente los PR pendientes de SCRUM-111, SCRUM-112 o SCRUM-124/125.
