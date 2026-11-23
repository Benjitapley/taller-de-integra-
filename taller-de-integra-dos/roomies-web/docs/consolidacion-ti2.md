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

## Limpieza sobre dev-web `0bffc08`

Se verificó el árbol de Git antes de retirar la copia con espacios: sus únicos
368 archivos eran 367 artefactos de `.next-demo` y un `next-env.d.ts` generado.
No había código de aplicación exclusivo que trasladar. Se ignoran esa raíz
antigua y `.next-demo` para evitar que vuelvan a incorporarse. Se retiraron la
ruta ficticia `/recorrido-preview`, su componente y estilos, y el componente
de imágenes duplicado sin referencias. Se conservan las vistas de producto.

Se corrigieron mezclas de las últimas fusiones: estado y función duplicados en
Inicio, campos y código sin conectar en formularios, importación duplicada,
variable inexistente en validación y parámetros repetidos que impedían arrancar
Listado. La validación región/comuna consulta el catálogo persistido, no una
lista abreviada con códigos diferentes. Los errores al paginar conservan las
filas visibles y permiten reintentar el mismo cursor.

El código de aceptación de `225433f` permanece integrado. El ensayo C03 necesitó
corregir su proxy local para reenviar GET y Authorization y mostrar el log de
arranque cuando un proceso falla. No se modificaron bases compartidas, rutas
finales de perfil, main, configuración de Vercel ni Integración 4.

Comprobaciones locales de esta limpieza:

- Web: 128 pruebas aprobadas; la prueba separada de reportes en navegador quedó
  omitida en ese comando, no aprobada.
- Navegador con Next/BFF reales y transporte HTTP ficticio: 14 aprobadas,
  incluyendo formularios/comunas y aceptación recuperable.
- TypeScript, lint y compilación aislada: aprobados.
- Listado: 59 pruebas aprobadas con PostgreSQL efímero. La regresión adicional
  de filtros región/comuna pasó aparte: 1 aprobada, 59 deseleccionadas.
- C03: ensayo aprobado con cuatro procesos HTTP separados, SQL real temporal e
  identidad externa simulada. Cubre incorporación, permisos, reintentos,
  concurrencia por último cupo, pertenencia única, timeout y reinicio. Los
  cortes de conexión intencionales pueden emitir WinError 10053 en el proxy.

Estas comprobaciones no acreditan producción. Las rutas finales de perfil/foto
de SCRUM-94/111 y su persistencia remota siguen pendientes de la entrega de
Auth/Users. No se fusionaron las ramas pendientes 111/112 con esta limpieza.
