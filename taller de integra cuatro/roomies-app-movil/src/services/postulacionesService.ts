import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp } from "@/types/Http";
import type { EstadoPostulacion, Postulacion } from "@/types/Postulacion";

export type EstadoPostulacionDto = EstadoPostulacion;

const ESTADOS_POSTULACION: readonly EstadoPostulacionDto[] = [
  "Pendiente",
  "Preseleccionada",
  "Aceptada",
  "Rechazada",
  "Cancelada",
];

/** Lo que devuelve el backend al crear una postulación (campos usados). */
export interface PostulacionCreadaResponse {
  id_postulacion: number;
  id_publicacion: number;
  estado: EstadoPostulacionDto;
  fecha_postulacion?: string;
}

export type ResultadoPostulacion =
  | { exito: true; datos: PostulacionCreadaResponse; estadoHttp: number }
  | ErrorHttp;

/** Lo que se usa de `solicitarJson`. Las pruebas pueden pasar una versión simulada. */
export type EnviarPostulacion = typeof solicitarJson;

export const rutaPostular = (idPublicacion: number): string =>
  `/api/publicaciones/${idPublicacion}/postulaciones`;

function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 1;
}

// `datos` llega como unknown: JSON válido no es una respuesta válida.
function leerPostulacionCreada(datos: unknown): PostulacionCreadaResponse | null {
  if (typeof datos !== "object" || datos === null) return null;
  const { id_postulacion, id_publicacion, estado, fecha_postulacion } =
    datos as Record<string, unknown>;

  if (!esEnteroPositivo(id_postulacion) || !esEnteroPositivo(id_publicacion)) return null;
  if (
    typeof estado !== "string" ||
    !ESTADOS_POSTULACION.includes(estado as EstadoPostulacionDto)
  ) {
    return null;
  }

  return {
    id_postulacion,
    id_publicacion,
    estado: estado as EstadoPostulacionDto,
    ...(typeof fecha_postulacion === "string" ? { fecha_postulacion } : {}),
  };
}

/** Postula al usuario con sesión a una publicación de arrendador. */
export async function postularAPublicacion(
  idPublicacion: number,
  enviar: EnviarPostulacion = solicitarJson,
): Promise<ResultadoPostulacion> {
  if (!esEnteroPositivo(idPublicacion)) {
    return {
      exito: false,
      codigo: "peticion_invalida",
      error: "No pudimos identificar la publicación a la que quieres postular.",
    };
  }

  const resultado = await enviar(rutaPostular(idPublicacion), { metodo: "POST" });
  if (!resultado.exito) return resultado;

  const creada = leerPostulacionCreada(resultado.datos);
  if (!creada) {
    return {
      exito: false,
      codigo: "respuesta_invalida",
      error: "El servicio respondió algo que no pudimos interpretar.",
      estadoHttp: resultado.estadoHttp,
    };
  }
  return { exito: true, datos: creada, estadoHttp: resultado.estadoHttp };
}

// ---------------------------------------------------------------------------
// M4-C11: mis postulaciones
// ---------------------------------------------------------------------------

export const RUTA_MIS_POSTULACIONES = "/api/postulaciones/mias";

export type ResultadoMisPostulaciones =
  | { exito: true; datos: Postulacion[]; estadoHttp: number }
  | ErrorHttp;

// Convierte una fila del backend (snake_case) al modelo de la app. Devuelve null
// si falta algo esencial o el estado no es uno de los conocidos: nunca se
// inventa un estado, porque un estado equivocado se vería como una decisión.
function leerPostulacionPropia(fila: unknown): Postulacion | null {
  if (typeof fila !== "object" || fila === null) return null;
  const f = fila as Record<string, unknown>;

  if (
    !esEnteroPositivo(f.id_postulacion) ||
    !esEnteroPositivo(f.id_publicacion) ||
    !esEnteroPositivo(f.id_usuario)
  ) {
    return null;
  }
  if (
    typeof f.estado !== "string" ||
    !ESTADOS_POSTULACION.includes(f.estado as EstadoPostulacionDto)
  ) {
    return null;
  }
  if (typeof f.fecha_postulacion !== "string") return null;

  return {
    idPostulacion: f.id_postulacion,
    idPublicacion: f.id_publicacion,
    idUsuario: f.id_usuario,
    estado: f.estado as EstadoPostulacion,
    fechaPostulacion: f.fecha_postulacion,
    ...(typeof f.titulo === "string" && f.titulo.trim()
      ? { tituloPublicacion: f.titulo }
      : {}),
    ...(typeof f.motivo === "string" && f.motivo.trim() ? { motivo: f.motivo } : {}),
  };
}

/** Postulaciones de la persona con sesión, de la más reciente a la más antigua. */
export async function obtenerMisPostulaciones(
  enviar: EnviarPostulacion = solicitarJson,
): Promise<ResultadoMisPostulaciones> {
  const resultado = await enviar(RUTA_MIS_POSTULACIONES);
  if (!resultado.exito) return resultado;

  const respuestaInvalida: ErrorHttp = {
    exito: false,
    codigo: "respuesta_invalida",
    error: "El servicio respondió algo que no pudimos interpretar.",
    estadoHttp: resultado.estadoHttp,
  };

  if (!Array.isArray(resultado.datos)) return respuestaInvalida;

  const postulaciones: Postulacion[] = [];
  for (const fila of resultado.datos) {
    const postulacion = leerPostulacionPropia(fila);
    // Una fila ilegible invalida toda la respuesta: no se muestra una lista a medias.
    if (!postulacion) return respuestaInvalida;
    postulaciones.push(postulacion);
  }
  return { exito: true, datos: postulaciones, estadoHttp: resultado.estadoHttp };
}
