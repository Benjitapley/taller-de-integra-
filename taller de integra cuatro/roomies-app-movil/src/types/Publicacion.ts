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

export interface FormularioPublicacionValores {
  tipo: TipoPublicacion;
  titulo: string;
  precio: string; // solo dígitos, ejemplo. "11000"
  ubicacion: string;
  cupos: string; // solo dígitos (1 cupo, 2 cupos, etc.)
  descripcion: string;
  enlaceReferencia: string; // opcional, solo aplica a Compartida (el enlace de la publicación de otro sitio)
}

export const formularioPublicacionInicialConOrigen = (
  tipo: TipoPublicacion,
): FormularioPublicacionValores => ({
  tipo,
  titulo: '',
  precio: '',
  ubicacion: '',
  cupos: '',
  descripcion: '',
  enlaceReferencia: '',
});
