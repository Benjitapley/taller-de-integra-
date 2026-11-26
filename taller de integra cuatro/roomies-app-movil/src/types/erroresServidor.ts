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

// Mensajes de postulación. Reemplazan a los de arriba porque el mismo código
// (p. ej. correo_no_verificado) se explica distinto al postular que al publicar.
// Cubren los 409 del contrato 4.2 y el 403 de publicación propia.
const MENSAJES_POSTULACION: Record<string, string> = {
  postulacion_duplicada: "Ya tienes una postulación abierta a esta publicación.",
  reingreso_no_permitido: "No puedes volver a postular: saliste de este arriendo o te retiraron de él.",
  estado_invalido: "Ya no puedes postular a esta publicación porque tu postulación anterior fue rechazada.",
  sin_cupos: "Esta publicación ya no tiene cupos disponibles.",
  publicacion_cerrada: "Esta publicación está cerrada y no admite postulaciones.",
  ya_pertenece_a_arriendo: "Ya perteneces a un arriendo, así que no puedes postular a otro.",
  sin_permiso: "No puedes postular a una publicación tuya.",
  correo_no_verificado: "Verifica tu correo para poder postular.",
  no_encontrado: "No encontramos esta postulación o publicación.",
  demasiados_intentos: "Demasiados intentos. Espera un momento e inténtalo otra vez.",
};

// Mensajes del retiro (POST /api/postulaciones/{id}/retiro).
const MENSAJES_RETIRO: Record<string, string> = {
  estado_invalido:
    "Esta postulación ya no se puede retirar: solo se retiran las que están Pendientes o Preseleccionadas.",
  sin_permiso: "Solo quien postuló puede retirar la postulación.",
  no_encontrado: "No encontramos esta postulación.",
  demasiados_intentos: "Demasiados intentos. Espera un momento e inténtalo otra vez.",
};

function elegir(error: ErrorHttp, tabla: Record<string, string>): string {
  return (error.codigoServidor && tabla[error.codigoServidor]) || error.error;
}

// Listado todavía responde {"detail": ...} sin `codigo` al postular: sin código, el estado
// HTTP es lo único que distingue el caso, y un 409 reúne varias causas.
export const mensajeDePostulacion = (error: ErrorHttp): string => {
  if (!error.codigoServidor) {
    if (error.estadoHttp === 409) {
      return "No se pudo postular: ya tienes una postulación vigente, la publicación está cerrada o ya no tiene cupos.";
    }
    if (error.estadoHttp === 403) return "No puedes postular a esta publicación.";
  }
  return elegir(error, MENSAJES_POSTULACION);
};
// Listado responde el retiro sin `codigo`: 403 si no es el postulante, 404 si no existe.
// El 409 reúne dos causas (incorporación en curso o estado no retirable); el mensaje las menciona.
export const mensajeDeRetiro = (error: ErrorHttp): string => {
  if (!error.codigoServidor) {
    if (error.estadoHttp === 403) return MENSAJES_RETIRO.sin_permiso;
    if (error.estadoHttp === 404) return MENSAJES_RETIRO.no_encontrado;
    if (error.estadoHttp === 409) {
      return "No se pudo retirar: la postulación ya no está abierta o su incorporación sigue en curso. Revisa su estado e inténtalo más tarde.";
    }
  }
  return elegir(error, MENSAJES_RETIRO);
};
