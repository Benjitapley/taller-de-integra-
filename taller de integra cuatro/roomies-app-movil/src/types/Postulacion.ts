export type EstadoPostulacion =
  | 'Pendiente'
  | 'Preseleccionada'
  | 'Aceptada'
  | 'Rechazada';

export interface Postulacion {
  idPostulacion: number;
  idPublicacion: number;
  idUsuario: number;
  estado: EstadoPostulacion;
  fechaPostulacion: string;
}
