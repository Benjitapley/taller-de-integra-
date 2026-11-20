import type { ErrorHttp } from "@/types/Http";

const MENSAJES_POR_CODIGO: Record<string, string> = {
  correo_no_verificado: "Verifica tu correo para poder publicar.",
  sin_permiso: "No tienes permiso para realizar esta acción.",
  archivo_muy_grande: "Una de las fotos pesa más de 5 MB. Elige una más liviana.",
  tipo_archivo_no_permitido: "Solo se aceptan fotos JPG, PNG o WEBP.",
  validacion: "Revisa los datos de la publicación: alguno no es válido.",
  publicacion_cerrada: "Esta publicación está cerrada.",
  configuracion_bloqueada: "Esta configuración ya no se puede modificar.",
  sin_cupos: "La publicación no tiene cupos disponibles.",
  demasiados_intentos: "Demasiados intentos. Espera un momento e inténtalo otra vez.",
  dependencia_no_disponible:
    "Un servicio no respondió. Puedes reintentar: no se creará una publicación duplicada.",
};

export function mensajeDeError(error: ErrorHttp): string {
  return (error.codigoServidor && MENSAJES_POR_CODIGO[error.codigoServidor]) || error.error;
}
