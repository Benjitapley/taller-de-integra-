export type EstadoPostulacion =
  | 'Pendiente'
  | 'Preseleccionada'
  | 'Aceptada'
  | 'Rechazada'
  | 'Cancelada';

// Motivos fijos de cancelación del contrato (sección 2). Cualquier otro texto en
// una postulación Cancelada se muestra tal cual, sin interpretarlo.
export const MOTIVO_RETIRO_VOLUNTARIO = 'Retiro voluntario';
export const MOTIVO_CIERRE_PUBLICACION = 'Cierre de publicación';
export const MOTIVO_OTRO_ARRIENDO = 'Incorporación a otro arriendo';

export interface Postulacion {
  idPostulacion: number;
  idPublicacion: number;
  idUsuario: number;
  estado: EstadoPostulacion;
  fechaPostulacion: string;
  fechaEstado?: string;
  tituloPublicacion?: string;
  estadoPublicacion?: string;
  /** Texto del arrendador al rechazar, o motivo fijo de cancelación. */
  motivo?: string;
  /** Solo viene con la postulación Aceptada (contrato 4.2). */
  idArriendo?: number;
}

export interface PaginaPostulaciones {
  items: Postulacion[];
  /** null cuando no hay más páginas. */
  siguienteCursor: string | null;
}
