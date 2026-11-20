export type TipoPublicacion = 'Arrendador' | 'Compartida';

export type EstadoPublicacion = 'Disponible' | 'Activa' | 'Cerrada';

/** Valores de `tipo_vivienda` del contrato (cap. 4.1): Casa | Departamento | Habitacion. */
export type TipoVivienda = 'casa' | 'departamento' | 'habitacion';

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
  /** Ids del catálogo de TI2 en texto; "" mientras no se elige. */
  idRegion: string;
  idComuna: string;
  /** Nombres solo para mostrarlos (vista previa); no se envían. */
  nombreRegion: string;
  nombreComuna: string;
  tipoVivienda: TipoVivienda | ''; 
  cupos: string; // solo dígitos (1 cupo, 2 cupos, etc.)
  descripcion: string;
  enlaceReferencia: string; // opcional, solo aplica a Compartida (el enlace de la publicación de otro sitio)
  aceptaMascotas: boolean; // el contrato solo pide mascota "si"/"no"
  permitirComentarios: boolean;
  /** Solo Arrendador: hasta 20 textos de máx. 300 caracteres. */
  reglas: string[];
}

export const formularioPublicacionInicialConOrigen = (
  tipo: TipoPublicacion,
): FormularioPublicacionValores => ({
  tipo,
  titulo: '',
  precio: '',
  idRegion: '',
  idComuna: '',
  nombreRegion: '',
  nombreComuna: '',
  tipoVivienda: '',
  cupos: '',
  descripcion: '',
  enlaceReferencia: '',
  aceptaMascotas: false,
  permitirComentarios: false,
  reglas: [],
});

export type ErroresFormularioPublicacion = Partial<
  Record<keyof FormularioPublicacionValores, string>
>;
