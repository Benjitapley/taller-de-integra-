# S3R-E01: pendientes después de las comprobaciones adicionales

## Completado y comprobado

- Next.js y ESLint Next 16.4.6; regresión completa repetida tras ampliar el test:
  157 aprobadas, 0 fallidas, 0 omitidas, salida 0 (146478 ms).
  ESLint de la prueba modificada correcto. Lint, TypeScript y build completos
  correctos en la revisión anterior; no se modificó código de producción.
- Autenticación real mediante psycopg contra PostgreSQL 19.0 en 127.0.0.1:5432.
  Existencia de las tres bases locales y los roles propios de servicio comprobada.
  Las consultas fueron de solo lectura; no acredita persistencia del negocio.
- Recorrido adicional de navegador: filtro vacío y cursor reiniciado; rechazo de
  precios fraccionarios, negativos y superiores al máximo sin enviar el formulario;
  crear con tres imágenes a 230000/capacidad 2; editar conservando una, quitando dos
  y agregando otra a 245000; recargar y cerrar conservando dos imágenes.
  HTTP e imágenes sintéticos: no acredita Supabase ni fotografías del equipo.

## Pendiente para aceptar E01

1. Preparar el entorno integrado: configurar Auth/Storage con el proyecto y claves
   reales; credenciales de los roles SQL; aprovisionamiento/migraciones compatible
   con los roles existentes; arrancar Gateway, Listado, Auth y web. Las bases nuevas
   no tienen tablas de aplicación. El modo local admite la base
   `roomies_sprint2_disposable`; las otras dos requieren una topología soportada.
2. Crear las dos cuentas verificadas y ejecutar crear/encontrar/editar/cerrar con
   fotografías del equipo y URLs de Storage reales. Comprobar otra sesión y
   reiniciar Listado para verificar persistencia de datos y fotografías.
3. Acreditar contra servicios reales: más de dos páginas, filtro vacío, reinicio
   del cursor, cupos exactos 2 excluyendo 1/3, comuna inválida 422, capacidad
   conflictiva 409, enteros y límites de precio, y errores de carga/red sin perder
   archivos ni mostrar éxito. Conservar publicaciones de otras regiones.
4. Adjuntar HTTP/capturas reales sanitizadas, identificar el candidato desplegado,
   entorno y migraciones; coordinar los mismos ejemplos con TI4 y enlazar PR/Jira.

El recorrido físico completo de Expo y convivencia pertenece a E06; aquí falta
la coordinación y los ejemplos reales de publicaciones exigidos por E01.
No marcar E01 aceptado mientras falten las comprobaciones anteriores.

Detalle: [auditoría](S3R-E01-aceptacion-real.md) y
[prueba dirigida](S3R-E01-comprobaciones-adicionales.txt).
Resultado de la [regresión completa](S3R-E01-regresion-adicional.txt).
