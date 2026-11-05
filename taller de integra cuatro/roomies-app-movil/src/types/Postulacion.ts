export type EstadoPostulacion =
  | 'Pendiente'
  | 'Preseleccionada'
  | 'Aceptada'
  | 'Rechazada'
  | 'Cancelada'; 

export interface Postulacion {
  idPostulacion: number;
  idPublicacion: number;
  idUsuario: number;
  estado: EstadoPostulacion;
  fechaPostulacion: string;
  tituloPublicacion?: string;
  motivo?: string;
}
