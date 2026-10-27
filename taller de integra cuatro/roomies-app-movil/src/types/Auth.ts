import type { Session, User } from "@supabase/supabase-js";
import type { UsuarioPerfil } from "./Usuario";

/** M4-A03: identidad del proveedor. Su `id` es el UUID de Supabase Auth. */
export type IdentidadSupabase = User;

/** Sesión del SDK: identidad, access_token, refresh_token y vencimiento. */
export type SesionSupabase = Session;

/**
 * Un usuario autenticado puede no tener todavía su perfil Roomies cargado.
 * identidad.id (UUID) y perfil.idUsuario (ID de negocio) son identificadores
 * diferentes. No construir un perfil ficticio desde los datos del proveedor.
 */
export interface UsuarioActual {
  identidad: IdentidadSupabase;
  perfil: UsuarioPerfil | null;
}

export interface DatosRegistro {
  nombre: string;
  email: string;
  password: string;
  /** AAAA-MM-DD, enviada como user_metadata.fecha_nacimiento. */
  fechaNacimiento: string;
}

export type ErrorAutenticacion = { exito: false; error: string };

export type ResultadoRegistro =
  | ErrorAutenticacion
  | { exito: true; estado: "confirmacion_pendiente" }
  | { exito: true; estado: "sesion_iniciada"; sesion: SesionSupabase };

export type ResultadoConfirmacion =
  | ErrorAutenticacion
  | { exito: true; sesion: SesionSupabase };

export type ResultadoInicioSesion =
  | ErrorAutenticacion
  | { exito: true; sesion: SesionSupabase };

export type ResultadoCierreSesion =
  | { exito: true }
  | (ErrorAutenticacion & { sesionLocalCerrada: boolean });
