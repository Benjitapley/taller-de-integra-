export type EstadoPostulacion =
  | "Pendiente"
  | "Preseleccionada"
  | "Aceptada"
  | "Rechazada"
  | "Cancelada";

export type EstadoArriendo = "Activo" | "Finalizado";
export type EstadoTarea = "Pendiente" | "Completada";

/** DTOs de lectura para las vistas de Convivencia/Mensajería (Contrato S3 §2.4).
 * No implican que el servicio esté desplegado ni que estas rutas estén conectadas.
 */
export type IntegranteArriendoDto = {
  id_usuario: number;
  nombre: string | null;
  es_responsable: boolean;
  fecha_ingreso: string;
  activo: boolean;
};

export type ConversacionDto = {
  id_conversacion: number;
  id_arriendo: number;
  fecha_creacion: string;
};

export type MensajeDto = {
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
