# Recuperación — SCRUM-72 V2 (plan, no ejecutado)

No hay script automático de DROP ni de restauración de passwords. La prioridad es
conservar las cuatro tablas existentes y cualquier información JWT que ya se haya
emitido, sin reabrir el mecanismo inseguro anterior.

## Antes de una ejecución futura

1. Aprobar preflight, rol, RLS, duplicados, capacidad de hashes y recuperación de
   cuentas antiguas. El backend sigue deshabilitado; no abrir SMTP ni clientes reales.
2. Tener backup protegido/verificado y ensayar restauración en una base desechable.
   No exportar passwords a documentos de revisión ni al repositorio.
3. Detener escrituras del negocio en una ventana acordada, tomar recuentos y guardar
   definiciones de constraints/índices/permisos. Capturar versión y rol inspector.
4. Ejecutar TODO 02 como una transacción, con cliente que se detenga ante errores.
   El timeout de lock (5 s) y statement (60 s) provoca fallo seguro, no un reintento
   sin revisión. Nunca ejecutar solamente el CREATE que parezca faltar.

## Error antes del COMMIT

Si la sesión queda en estado de transacción abortada, emitir ROLLBACK en esa sesión
cuando se autorice la operación. La transacción revierte columna, índices, tablas,
secuencia, grants y políticas creadas. No había INSERT/UPDATE/DELETE de usuarios,
passwords, publicaciones, imágenes o conexiones que haya que deshacer.

No cambiar timeouts ni eliminar constraints para forzar el paso. Investigar la
precondición fallida y repetir preflight. Si el cliente continuó hasta COMMIT tras
un error, PostgreSQL finalizará con rollback; comprobar el resultado, no asumirlo.

## Conexión perdida o resultado de COMMIT incierto

Mantener el servicio bloqueado. Volver a inspeccionar el catálogo con autorización:
si no están los objetos, hacer preflight nuevamente; si están los tres objetos JWT,
usar postflight; si el estado no coincide, detener y diseñar recuperación específica.
No repetir la migración a ciegas: aborta deliberadamente si detecta objetos existentes.
El parámetro del rol debe volver a fijarse si se abre otra sesión inspectora.

## Fallo detectado después del COMMIT

1. No habilitar AUTH_JWT_ENABLED. Si ya hubo activación autorizada, deshabilitar y
   reiniciar controladamente TODAS las instancias (la configuración está cacheada).
   No volver a la autenticación roomies_id ni permitir plaintext.
2. Registrar metadatos, recuentos y estado de permisos sin capturar códigos o JWT.
   La migración es aditiva: en general se conserva el esquema y se prepara un fix
   hacia adelante aprobado, en vez de eliminar tablas nuevas.
3. Si ya existen códigos/sesiones, no descartarlos ni restaurar automáticamente toda
   la BD: podría perderse actividad posterior. Un cambio de secretos, revocación
   masiva o restauración requiere autorización y plan de impacto propios.
4. Una restauración de backup debe validarse primero en una instancia separada,
   conciliar publicaciones/conexiones posteriores y contar con aprobación explícita.
   No incluye marcar usuarios como verificados ni cambiar passwords.

## Criterios para cerrar la revisión

Postflight consistente: mismos recuentos/IDs/datos antiguos en una ventana sin
escrituras, constraints existentes conservados, nuevos índices válidos, todos los
usuarios no verificados y cero códigos/sesiones inmediatamente tras migrar. RLS
habilitado en ambas tablas nuevas, grants del servicio y secuencia revisados, sin
lectura/escritura cliente sobre códigos, sesiones, passwords o verificado.

Los checks de SELECT no acreditan por sí solos toda la identidad de datos o ausencia
de filtración por funciones/vistas. Se necesita revisión de catálogo y ensayos con
roles en una base desechable. Esta preparación no habilita el backend ni Next.js.
