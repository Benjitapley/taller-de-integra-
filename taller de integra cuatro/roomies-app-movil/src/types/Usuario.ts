export type RolUsuario = 'Usuario' | 'Admin';

export type OcupacionUsuario = 'Estudiante' | 'Trabajador' | 'Ambos';

/**
 * Datos de usuario que pueden utilizarse en las primeras vistas del cliente.
 * Se basa en la entidad Usuario del MER y en FR-12/FR-13 del SRS.
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
   * Campo derivado de las evaluaciones. No existe como atributo directo
   * de Usuario en el MER, pero FR-13 contempla la calificación como filtro.
   * Queda opcional hasta que TI2 defina el contrato definitivo.
   */
  calificacionPromedio?: number;
}

/** Datos adicionales que corresponden al perfil del propio usuario. */
export interface UsuarioPerfil extends Usuario {
  email: string;
}
