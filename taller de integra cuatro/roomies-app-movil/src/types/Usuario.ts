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