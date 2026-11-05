export type TipoPublicacion = 'Arrendador' | 'Compartida';

export type EstadoPublicacion = 'Disponible' | 'Activa' | 'Cerrada';

/** Valores que acepta `tipo_vivienda` en PublicacionCrear (publicaciones_service). */
export type TipoVivienda = 'casa' | 'departamento' | 'habitacion';

/** Valores que acepta `tipos_mascotas_aceptadas` en la API de TI2. */
export type TipoMascota = 'perro' | 'gato' | 'ave' | 'tortuga' | 'conejo' | 'pez' | 'otro';

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
  tipoVivienda: TipoVivienda | ''; 
  cupos: string; // solo dígitos (1 cupo, 2 cupos, etc.)
  descripcion: string;
  enlaceReferencia: string; // opcional, solo aplica a Compartida (el enlace de la publicación de otro sitio)
  aceptaMascotas: boolean;
  tiposMascotas: TipoMascota[]; // solo se usa si aceptaMascotas es true
  condicionesMascotas: string; // opcional; obligatoria si se elige "otro"
  permitirComentarios: boolean;
}

export const formularioPublicacionInicialConOrigen = (
  tipo: TipoPublicacion,
): FormularioPublicacionValores => ({
  tipo,
  titulo: '',
  precio: '',
  ubicacion: '',
  tipoVivienda: '',
  cupos: '',
  descripcion: '',
  enlaceReferencia: '',
  aceptaMascotas: false,
  tiposMascotas: [],
  condicionesMascotas: '',
  permitirComentarios: false,
});

export type ErroresFormularioPublicacion = Partial<
  Record<keyof FormularioPublicacionValores, string>
>;
