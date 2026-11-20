/**
 * `enlace_referencia` (solo Compartida). El servicio responde 422 ("Campos no
 * permitidos") si lo recibe.
 */
export const ENVIAR_ENLACE_REFERENCIA = false;

/**
 * `permitir_comentarios`. El contrato responde 422 ante cualquier campo
 * fuera de su lista y este no está en ella. Con `false` no se muestra el interruptor,
 * no aparece en la vista previa y no se envía.
 */
export const ENVIAR_PERMITIR_COMENTARIOS = false;

/**
 * Publicación Compartida. Queda fuera del release (por el nuevo alcance TI2): con `false` el
 * menú de Publicar solo ofrece Arrendador. El código de Compartida se conserva.
 */
export const OFRECER_COMPARTIDA = false;
