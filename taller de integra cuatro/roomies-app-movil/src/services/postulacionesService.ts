import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp } from "@/types/Http";

// Servicio de postulaciones (M4-C10). Las funciones de lectura (GET
// /api/postulaciones/mias, M4-C11) se agregan en este mismo archivo.

export type EstadoPostulacionDto =
  | "Pendiente"
  | "Preseleccionada"
  | "Aceptada"
  | "Rechazada"
  | "Cancelada";

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
