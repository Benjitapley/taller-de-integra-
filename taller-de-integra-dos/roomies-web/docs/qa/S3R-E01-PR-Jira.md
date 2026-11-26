# S3R-E01 · Texto de PR y actualización de Jira

## Pull Request

Título: **SCRUM-118: integrar publicaciones E01 y parchear Next.js 16.4.6**

### Descripción

Los formularios de publicaciones dependían de errores `detail`, enviaban campos
heredados y no acreditaban el contrato Sprint 3 v2 en todos los recorridos. Esta
entrega integra el DTO, los errores canónicos y el multipart de Arrendador, y
actualiza Next.js y ESLint Next de 16.4.3 a 16.4.6 para aplicar el parche de seguridad.

El catálogo consulta cursores del servidor y cupos exactos. Los selectores ofrecen
La Araucanía y sus comunas. Crear/editar valida CLP entero, reglas e imágenes;
conserva textos, archivos, IDs y clave de operación cuando falla la API o la red.
El cierre requiere confirmación y conserva las imágenes. La vista previa y las
pantallas de catálogo/detalle siguen los tokens y la estructura de TI4.

### Validación

- Lint y TypeScript: correctos con Next.js 16.4.6.
- Suite completa con las tres suites opcionales de navegador habilitadas: 157 aprobadas, 0 fallidas, 0 omitidas.
- Build de producción: correcto, salida 0 con Next.js 16.4.6.
- npm audit: Next.js ya no reportado; permanecen 7 avisos moderados en dependencias de ESLint.
- Diff y archivos de la entrega revisados para excluir secretos y temporales.

La suite opcional de reportes tenía un fixture de integrantes incompleto. Se
actualizó al DTO vigente sin cambiar las validaciones del servidor.

Evidencia: [verificación local](../evidence/S3R-E01/verificacion-2026-11-26.md),
[contrato y guion TI4](../contracts/S3R-E01-TI4.md) y
[auditoría del entorno real](S3R-E01-aceptacion-real.md).

### Aceptación externa pendiente

No existe configuración activa del Gateway/Storage compartidos ni DSN de Listado
y administrador de pruebas para `127.0.0.1:5432`. Se verificó autenticación
administrativa real y existencia de bases/roles mediante consultas de solo lectura;
las bases aún no tienen tablas de aplicación. No acredita credenciales de los
roles de servicio, migraciones ni que el Gateway use esa base. Ver
[avance adicional y pendientes](S3R-E01-pendientes.md).

Falta crear/editar/cerrar con tres fotos reales, comprobar otra cuenta y reinicio,
recorrer más de dos páginas reales y verificar 422/409 con datos de servicios
reales. Las suites de navegador de esta entrega usan HTTP sintético y las capturas
lo documentan. El candidato no constituye evidencia de aceptación real.

**No cerrar S3R-E01 por integrar este PR.** Mantener el ticket abierto hasta adjuntar
la evidencia real, identificar SHA/digest desplegados y completar el acta TI4.

## Comentario listo para Jira

Implementación web de S3R-E01 integrada en el candidato de la rama SCRUM-118:
DTO/errores canónicos, multipart e imágenes recuperables, cursores y cupos exactos,
formularios Arrendador y diseño TI4. Next.js y ESLint Next actualizados a 16.4.6.

La evidencia local y la auditoría de configuración están adjuntas al cambio.
Validación: lint, TypeScript y build correctos; 157 pruebas aprobadas, sin fallos
ni omisiones, incluyendo las tres suites opcionales de navegador.
El SHA completo del candidato se entrega junto con el commit de esta revisión.

**Aceptación real bloqueada:** faltan Gateway, DSN de Listado/administrador de
pruebas en 5432, credencial backend de Storage y cuentas de prueba. No se ejecutó
el ciclo real con fotos del equipo ni el reinicio de servicios compartidos.

Estado propuesto: **En curso / bloqueado por entorno**, según el flujo de Jira.
No se propone marcar Terminado ni se contabilizan los fixtures como prueba real.
