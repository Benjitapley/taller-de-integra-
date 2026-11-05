export type RolUsuario = 'Usuario' | 'Admin';

export type OcupacionUsuario =
  | 'Estudiante'
  | 'Trabajador'
  | 'Ambos';

/**
 * Datos base del usuario utilizados por las primeras pantallas.
 *
 * Se basa en la entidad Usuario del MER y en los requisitos
 * FR-03, FR-12 y FR-13 del SRS.
 */
export interface Usuario {
  /** ID de negocio de Roomies; no corresponde al UUID de Supabase Auth. */
  idUsuario: number;
  rol: RolUsuario;
  nombre: string;
  fechaNacimiento: string;
  estadoVerificacion: string;
  presupuesto: number;
  zonaInteres: string;
  ocupacion: OcupacionUsuario;
  fotoPerfilUrl?: string;

  /**
   * Campo derivado de las evaluaciones.
   * No existe como atributo directo de Usuario en el MER,
   * pero FR-13 contempla la calificación como filtro.
   */
  calificacionPromedio?: number;

  /**
   * Cantidad de evaluaciones recibidas por el usuario.
   * Se mantiene opcional hasta contar con el contrato definitivo de TI2.
   */
  cantidadEvaluaciones?: number;
}

/**
 * Información adicional utilizada en la vista del perfil
 * del propio usuario.
 */
export interface UsuarioPerfil extends Usuario {
  email: string;

  /**
   * Información presentada en el perfil.
   * No corresponde actualmente a atributos definidos en el MER,
   * por lo que puede ajustarse cuando exista el contrato definitivo.
   */
  bio?: string;

  stats?: {
    publicaciones: number;
    mensajes: number;
    guardados: number;
    evaluaciones: number;
  };

  preferencias?: string[];

  buscaEn?: string[];
}

/**
 * GET /usuarios/me observado en OpenAPI de Auth/Users el 04/11/2026.
 * Las siete claves son obligatorias, aunque seis permiten valores nulos.
 * No equivale al modelo completo de usuario ni a los campos editables de PATCH.
 */
export interface PerfilPropioTi2 {
  nombre: string;
  edad: number | null;
  ocupacion: string | null;
  ciudad: string | null;
  breve_descripcion: string | null;
  sobre_mi: string | null;
  foto_perfil: string | null;
}

/**
 * Modelo de presentación de A08, independiente del DTO HTTP de TI2.
 * null significa dato no disponible; no equivale a cero, lista vacía o valor mock.
 * El adaptador confirmado deberá producir este modelo desde una respuesta validada.
 */
export interface PerfilPropioVista {
  nombre: string | null;
  email: string | null;
  fotoPerfilUrl: string | null;
  edad: number | null;
  ocupacion: string | null;
  ubicacion: string | null;
  breveDescripcion: string | null;
  bio: string | null;
  presupuesto: number | null;
  preferencias: string[] | null;
  buscaEn: string[] | null;
}
