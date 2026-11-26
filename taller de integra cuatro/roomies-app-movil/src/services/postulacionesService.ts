import { solicitarJson } from "@/services/httpClient";
import type { ErrorHttp } from "@/types/Http";
import type { EstadoPostulacion, PaginaPostulaciones, Postulacion } from "@/types/Postulacion";

export type EstadoPostulacionDto = EstadoPostulacion;

export const ESTADOS_POSTULACION: readonly EstadoPostulacionDto[] = [
  "Pendiente",
  "Preseleccionada",
  "Aceptada",
  "Rechazada",
  "Cancelada",
];


export const ESTADOS_RETIRABLES: readonly EstadoPostulacionDto[] = ["Pendiente", "Preseleccionada"];

export const puedeRetirarse = (estado: EstadoPostulacion): boolean =>
  ESTADOS_RETIRABLES.includes(estado);

export type EnviarPostulacion = typeof solicitarJson;

function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 1;
}

const respuestaInvalida = (estadoHttp: number): ErrorHttp => ({
  exito: false,
  codigo: "respuesta_invalida",
  error: "El servicio respondió algo que no pudimos interpretar.",
  estadoHttp,
});

// Un fallo "ambiguo" no dice si la operación se aplicó: la petición pudo llegar al
// servidor aunque la respuesta no volviera. Antes de repetirla se consulta el estado.
export function esResultadoAmbiguo(error: ErrorHttp): boolean {
  if (error.codigo === "red" || error.codigo === "tiempo_agotado") return true;
  return error.codigo === "respuesta_invalida" && (error.estadoHttp ?? 0) < 300;
}

// ---------------------------------------------------------------------------
// Lectura de una postulación (la misma forma en la lista y en el detalle)
// ---------------------------------------------------------------------------

export function leerPostulacion(fila: unknown): Postulacion | null {
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

  const estado = f.estado as EstadoPostulacion;
  return {
    idPostulacion: f.id_postulacion,
    idPublicacion: f.id_publicacion,
    idUsuario: f.id_usuario,
    estado,
    fechaPostulacion: f.fecha_postulacion,
    ...(typeof (f.fecha_estado ?? f.actualizada_en) === "string"
      ? { fechaEstado: (f.fecha_estado ?? f.actualizada_en) as string }
      : {}),
    ...(typeof f.titulo === "string" && f.titulo.trim() ? { tituloPublicacion: f.titulo } : {}),
    ...(typeof f.estado_publicacion === "string" && f.estado_publicacion
      ? { estadoPublicacion: f.estado_publicacion }
      : {}),
    ...(typeof f.motivo === "string" && f.motivo.trim() ? { motivo: f.motivo } : {}),
    // id_arriendo solo tiene sentido con la postulación Aceptada (contrato 4.2).
    ...(estado === "Aceptada" && esEnteroPositivo(f.id_arriendo) ? { idArriendo: f.id_arriendo } : {}),
  };
}

// ---------------------------------------------------------------------------
// Postular 
// ---------------------------------------------------------------------------

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

export const rutaPostular = (idPublicacion: number): string =>
  `/api/publicaciones/${idPublicacion}/postulaciones`;

// `datos` llega como unknown: JSON válido no es una respuesta válida.
function leerPostulacionCreada(datos: unknown): PostulacionCreadaResponse | null {
  if (typeof datos !== "object" || datos === null) return null;
  const { id_postulacion, id_publicacion, estado, fecha_postulacion } =
    datos as Record<string, unknown>;

  if (!esEnteroPositivo(id_postulacion) || !esEnteroPositivo(id_publicacion)) return null;
  // El contrato (4.2) responde 201 con la postulación en Pendiente.
  if (estado !== "Pendiente") return null;

  return {
    id_postulacion,
    id_publicacion,
    estado,
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

  // Solo un 201 válido cuenta como postulación creada; otro 2xx no se da por bueno.
  const creada = resultado.estadoHttp === 201 ? leerPostulacionCreada(resultado.datos) : null;
  if (!creada) return respuestaInvalida(resultado.estadoHttp);
  return { exito: true, datos: creada, estadoHttp: resultado.estadoHttp };
}

/**
 * Como `postularAPublicacion`, pero si el resultado es ambiguo (corte de red,
 * tiempo agotado, respuesta ilegible) consulta "mis postulaciones" antes de dar un
 * error: si ya hay una postulación abierta a esa publicación, la envió el intento
 * anterior y no hay que repetirla. Así no se crea una segunda.
 */
export async function postularConVerificacion(
  idPublicacion: number,
  enviar: EnviarPostulacion = solicitarJson,
): Promise<ResultadoPostulacion> {
  const resultado = await postularAPublicacion(idPublicacion, enviar);
  if (resultado.exito || !esResultadoAmbiguo(resultado)) return resultado;

  const consulta = await obtenerMisPostulaciones({}, enviar);
  if (!consulta.exito) return resultado; // sin poder verificar, se conserva el aviso de "revisa antes de reintentar"

  const abierta = consulta.datos.items.find(
    (p) => p.idPublicacion === idPublicacion && puedeRetirarse(p.estado),
  );
  if (!abierta) return resultado;
  return {
    exito: true,
    estadoHttp: 200,
    datos: {
      id_postulacion: abierta.idPostulacion,
      id_publicacion: abierta.idPublicacion,
      // La app solo muestra el estado que informa el servidor.
      estado: abierta.estado,
      fecha_postulacion: abierta.fechaPostulacion,
    },
  };
}

// ---------------------------------------------------------------------------
// Mis postulaciones 
// ---------------------------------------------------------------------------

export const RUTA_MIS_POSTULACIONES = "/api/postulaciones/mias";

export interface OpcionesMisPostulaciones {
  /** Cursor opaco de la página anterior (`siguiente_cursor`). */
  cursor?: string;
  /** 1–100; por defecto el servidor usa 20. */
  limite?: number;
  estado?: EstadoPostulacion;
}

export type ResultadoMisPostulaciones =
  | { exito: true; datos: PaginaPostulaciones; estadoHttp: number }
  | ErrorHttp;

function rutaMisPostulaciones(opciones: OpcionesMisPostulaciones): string | null {
  const parametros: string[] = [];
  if (opciones.limite !== undefined) {
    if (!Number.isInteger(opciones.limite) || opciones.limite < 1 || opciones.limite > 100) return null;
    parametros.push(`limite=${opciones.limite}`);
  }
  if (opciones.estado !== undefined) {
    if (!ESTADOS_POSTULACION.includes(opciones.estado)) return null;
    parametros.push(`estado=${encodeURIComponent(opciones.estado)}`);
  }
  if (opciones.cursor !== undefined) {
    if (typeof opciones.cursor !== "string" || !opciones.cursor) return null;
    parametros.push(`cursor=${encodeURIComponent(opciones.cursor)}`);
  }
  return parametros.length ? `${RUTA_MIS_POSTULACIONES}?${parametros.join("&")}` : RUTA_MIS_POSTULACIONES;
}

/** Una página de las postulaciones de la persona con sesión, de la más reciente a la más antigua. */
export async function obtenerMisPostulaciones(
  opciones: OpcionesMisPostulaciones = {},
  enviar: EnviarPostulacion = solicitarJson,
): Promise<ResultadoMisPostulaciones> {
  const ruta = rutaMisPostulaciones(opciones);
  if (!ruta) {
    return {
      exito: false,
      codigo: "peticion_invalida",
      error: "Los filtros de la consulta no son válidos.",
    };
  }

  const resultado = await enviar(ruta);
  if (!resultado.exito) return resultado;
  // { items, siguiente_cursor } (null al terminar). Listado todavía responde
  // un arreglo simple (hasta 100, sin paginar): se acepta como una única página.
  const cuerpo = resultado.datos;
  let items: unknown;
  let siguiente_cursor: unknown = null;
  if (Array.isArray(cuerpo)) {
    items = cuerpo;
  } else if (typeof cuerpo === "object" && cuerpo !== null) {
    ({ items, siguiente_cursor } = cuerpo as Record<string, unknown>);
  } else {
    return respuestaInvalida(resultado.estadoHttp);
  }
  if (!Array.isArray(items)) return respuestaInvalida(resultado.estadoHttp);
  if (siguiente_cursor !== null && (typeof siguiente_cursor !== "string" || !siguiente_cursor)) {
    return respuestaInvalida(resultado.estadoHttp);
  }

  const postulaciones: Postulacion[] = [];
  for (const fila of items) {
    const postulacion = leerPostulacion(fila);
    // Una fila ilegible invalida toda la respuesta: no se muestra una lista a medias.
    if (!postulacion) return respuestaInvalida(resultado.estadoHttp);
    postulaciones.push(postulacion);
  }
  return {
    exito: true,
    datos: { items: postulaciones, siguienteCursor: siguiente_cursor },
    estadoHttp: resultado.estadoHttp,
  };
}

// ---------------------------------------------------------------------------
// Detalle y retiro 
// ---------------------------------------------------------------------------

export const rutaPostulacion = (idPostulacion: number): string =>
  `/api/postulaciones/${idPostulacion}`;
export const rutaRetiro = (idPostulacion: number): string =>
  `/api/postulaciones/${idPostulacion}/retiro`;

export type ResultadoPostulacionDetalle =
  | { exito: true; datos: Postulacion; estadoHttp: number }
  | ErrorHttp;

const idInvalido = (): ErrorHttp => ({
  exito: false,
  codigo: "peticion_invalida",
  error: "No pudimos identificar la postulación.",
});

/** GET /api/postulaciones/{id}. El historial de cambios de estado no se interpreta todavía. */
export async function obtenerPostulacion(
  idPostulacion: number,
  enviar: EnviarPostulacion = solicitarJson,
): Promise<ResultadoPostulacionDetalle> {
  if (!esEnteroPositivo(idPostulacion)) return idInvalido();
  const resultado = await enviar(rutaPostulacion(idPostulacion));
  if (!resultado.exito) return resultado;

  const postulacion = leerPostulacion(resultado.datos);
  // Pedir la postulación 7 y recibir otra no es una respuesta válida.
  if (!postulacion || postulacion.idPostulacion !== idPostulacion) {
    return respuestaInvalida(resultado.estadoHttp);
  }
  return { exito: true, datos: postulacion, estadoHttp: resultado.estadoHttp };
}

export type ResultadoRetiro =
  | { exito: true; datos: Postulacion; estadoHttp: number }
  | ErrorHttp;

/**
 * POST /api/postulaciones/{id}/retiro. Solo Pendiente o Preseleccionada pueden
 * retirarse; el servidor decide y responde 409 `estado_invalido` en otro caso.
 *
 * Si la respuesta es ambigua (corte, tiempo agotado, cuerpo ilegible), NO se repite
 * el POST: se consulta la postulación. Con estado Cancelada el retiro se aplicó;
 * con Pendiente o Preseleccionada no se aplicó y se devuelve el error original, de
 * modo que reintentar es seguro.
 */
export async function retirarPostulacion(
  idPostulacion: number,
  enviar: EnviarPostulacion = solicitarJson,
): Promise<ResultadoRetiro> {
  if (!esEnteroPositivo(idPostulacion)) return idInvalido();

  const resultado = await enviar(rutaRetiro(idPostulacion), { metodo: "POST" });

  if (resultado.exito) {
    const retirada = leerPostulacion(resultado.datos);
    if (retirada && retirada.idPostulacion === idPostulacion && retirada.estado === "Cancelada") {
      return { exito: true, datos: retirada, estadoHttp: resultado.estadoHttp };
    }
    // 2xx sin una postulación Cancelada legible: se comprueba en el servidor.
    return verificarRetiro(idPostulacion, respuestaInvalida(resultado.estadoHttp), enviar);
  }

  if (!esResultadoAmbiguo(resultado)) return resultado;
  return verificarRetiro(idPostulacion, resultado, enviar);
}

async function verificarRetiro(
  idPostulacion: number,
  original: ErrorHttp,
  enviar: EnviarPostulacion,
): Promise<ResultadoRetiro> {
  const consulta = await obtenerPostulacion(idPostulacion, enviar);
  if (consulta.exito && consulta.datos.estado === "Cancelada") {
    return { exito: true, datos: consulta.datos, estadoHttp: consulta.estadoHttp };
  }
  return original;
}
