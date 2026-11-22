// Campos del formulario de publicación que el servicio de TI2
// (listado-applications-service) todavía no acepta. Con `false` no se muestran en
// el formulario, no se validan, no aparecen en la vista previa y no se envían.
// Cambiar a `true` cuando TI2 los agregue: el resto del código ya está listo.

/**
 * `enlace_referencia` (solo Compartida). El servicio responde 422 ("Campos no
 * permitidos") si lo recibe.
 */
export const ENVIAR_ENLACE_REFERENCIA = false;

/**
 * `tipos_mascotas_aceptadas` y `condiciones_mascotas`. El servicio responde 422 si
 * los recibe. Hoy solo se envía `mascota` "si"/"no".
 */
export const ENVIAR_DETALLE_MASCOTAS = false;
