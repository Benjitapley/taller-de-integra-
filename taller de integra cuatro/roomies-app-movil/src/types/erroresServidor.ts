import type { ErrorHttp } from "@/types/Http";

// Mensajes por `codigo` del contrato (1.4). El cliente decide el texto; el del
// servidor no se muestra. Si el código no se conoce, se usa el mensaje genérico.
const MENSAJES_POR_CODIGO: Record<string, string> = {
  correo_no_verificado: "Verifica tu correo para poder publicar.",
  sin_permiso: "No tienes permiso para realizar esta acción.",
  archivo_muy_grande: "Una de las fotos pesa más de 5 MB. Elige una más liviana.",
  tipo_archivo_no_permitido: "Solo se aceptan fotos JPG, PNG o WEBP.",
  validacion: "Revisa los datos de la publicación: alguno no es válido.",
  publicacion_cerrada: "Esta publicación está cerrada.",
  configuracion_bloqueada: "Esta configuración ya no se puede modificar.",
  sin_cupos: "La publicación no tiene cupos disponibles.",
  estado_invalido:
    "No se puede hacer el cambio en el estado actual: la capacidad no puede ser menor que los integrantes, o hay una aceptación en curso. Recarga el aviso e inténtalo más tarde.",
  demasiados_intentos: "Demasiados intentos. Espera un momento e inténtalo otra vez.",
  dependencia_no_disponible:
    "Un servicio no respondió. Puedes reintentar: no se creará una publicación duplicada.",
};

export function mensajeDeError(error: ErrorHttp): string {
  return (error.codigoServidor && MENSAJES_POR_CODIGO[error.codigoServidor]) || error.error;
}
