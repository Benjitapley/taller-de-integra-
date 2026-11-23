export const LIMITE_MENSAJES_POR_PAGINA = 20;
export const LIMITE_PAGINA_MINIMO = 1;
export const LIMITE_PAGINA_MAXIMO = 100;
export const LARGO_TEXTO_MINIMO = 1;
export const LARGO_TEXTO_MAXIMO = 2000;

/**
 * Elemento de GET /api/conversaciones. El contrato dice "nombre visible y ultimo mensaje"
 * pero no define esos campos: el movil solo usa id_conversacion.
 */
export interface ConversacionDto {
  id_conversacion: number;
}

/** Respuesta de mensaje (GET de la lista y POST). id_cliente solo se devuelve al emisor. */
export interface MensajeDto {
  id_mensaje: number; // monotono dentro de la conversacion
  id_conversacion: number;
  id_emisor: number; // id_usuario del autor
  contenido: string; // 1-2000
  fecha: string; // ISO 8601 UTC
  id_cliente?: string | null; // uuid, solo en mensajes propios
}

/** Forma comun de las paginas: items + siguiente_cursor (null = no hay mas). */
export interface PaginaDto<T> {
  items: T[];
  siguiente_cursor: string | null;
}

/** Cuerpo de POST /api/conversaciones/{id}/mensajes. No lleva Idempotency-Key. */
export interface MensajeCrearDto {
  contenido: string;
  id_cliente: string;
}
