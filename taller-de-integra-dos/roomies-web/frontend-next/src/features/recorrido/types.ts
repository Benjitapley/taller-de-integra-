export type EstadoPostulacion =
  | "Pendiente"
  | "Preseleccionada"
  | "Aceptada"
  | "Rechazada"
  | "Cancelada";

export type EstadoArriendo = "Activo" | "Finalizado";
export type ArriendoDto = {
  id_arriendo: number;
  id_publicacion: number;
  estado: EstadoArriendo;
  cupos_totales: number;
  integrantes_activos: number;
  cupos_disponibles: number;
  id_responsable: number | null;
  puede_retirar?: boolean;
  id_usuario_actual?: number;
};
export type EstadoTarea = "Pendiente" | "Completada";

/** Tipos de lectura para las vistas E00. Cotejados con el contrato Sprint 3 v2;
 * la forma final del DTO y las etiquetas de TI4 aún requieren acuerdo.
 * No implican que el servicio esté desplegado ni que estas rutas estén conectadas.
 */
export type MiArriendoVista = ArriendoDto;

export type IntegranteArriendoDto = {
  id_usuario: number;
  nombre: string | null;
  /** Responsable de convivencia: no identifica al dueño de la publicación. */
  es_responsable: boolean;
  fecha_ingreso: string;
  activo: boolean;
};

export type ConversacionDto = {
  id_conversacion: number;
  id_arriendo: number;
  fecha_creacion: string;
};

/** Campos del mensaje confirmados en el contrato Sprint 3 v2, sección 6.4.
 * id_cliente solo se devuelve al emisor.
 */
export type MensajeDto = {
  id_mensaje: number;
  id_conversacion: number;
  id_emisor: number;
  contenido: string;
  fecha: string;
  id_cliente?: string;
};

/** Nombre resuelto para la vista; no se presume incluido en el DTO de mensajes. */
export type MensajeVista = MensajeDto & { nombre_emisor: string };

/** Forma que entrega hoy el servicio de chat integrado en dev-web.
 * Requiere migración coordinada al DTO v2 antes de declarar compatibilidad contractual.
 */
export type MensajeServicioDto = {
  id_mensaje: number;
  id_conversacion: number;
  id_remitente: number;
  nombre_remitente: string;
  contenido: string;
  fecha_envio: string;
  id_cliente?: string;
};

export type TareaDto = {
  id_tarea: number;
  id_arriendo: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  id_creador: number;
  id_asignado: number | null;
  fecha_creacion: string;
};

export type EstadoRecurso<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "forbidden" }
  | { status: "empty" }
  | { status: "ready"; data: T };
