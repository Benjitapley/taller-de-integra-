export type TipoPublicacion = 'Arrendador' | 'Compartida';

export type EstadoPublicacion = 'Disponible' | 'Activa' | 'Cerrada';

/**
 * Modelo de publicación utilizado por el cliente móvil.
 *
 * Se basa en la entidad Publicacion del MER y en la respuesta orientativa
 * de consulta de publicaciones entregada por TI2.
 */
export interface Publicacion {
  idPublicacion: number;
  idUsuario: number;
  tipo: TipoPublicacion;
  titulo: string;
  descripcion: string;
  precio: number;
  ubicacion: string;
  estado: EstadoPublicacion;
  cuposTotales: number;

  /**
   * Campo calculado por el backend a partir de cupos_totales y los
   * integrantes activos del arriendo. No es un dato independiente del MER.
   */
  cuposDisponibles: number;

  imagenPrincipalUrl?: string;
}
