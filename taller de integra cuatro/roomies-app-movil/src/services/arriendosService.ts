import { solicitarJson } from "@/services/httpClient";
import type {
  ArriendoDto,
  EstadoArriendoDto,
  IntegranteArriendoDto,
  OrigenArriendoDto,
  RolIntegranteDto,
} from "@/types/api/ArriendoDto";
import type {
  ArriendoVista,
  IntegranteArriendoVista,
  ResultadoMiArriendo,
  SinPertenencia,
} from "@/types/Arriendo";
import type { ErrorHttp } from "@/types/Http";
import { resolverUrlFoto } from "@/utils/urlFoto";

export type EnviarArriendos = typeof solicitarJson;

export const RUTA_MI_ARRIENDO = "/api/arriendos/mio";
export const rutaArriendo = (idArriendo: number): string => `/api/arriendos/${idArriendo}`;
export const rutaPublicacion = (idPublicacion: number): string => `/api/publicaciones/${idPublicacion}`;

/** Límite por página (contrato 1.3: 1-100, 20 por defecto). */
export const LIMITE_PAGINA_INTEGRANTES = 50;
/** Tope de seguridad para no encadenar páginas indefinidamente. */
export const MAX_PAGINAS_INTEGRANTES = 5;

const LARGO_MAX_CURSOR = 512;

export function rutaIntegrantes(
  idArriendo: number,
  limite: number = LIMITE_PAGINA_INTEGRANTES,
  cursor: string | null = null,
): string {
  // activos=true: contrato 6.1. Si el servicio no pagina, ignora limite y cursor.
  const consulta = `activos=true&limite=${limite}${cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`}`;
  return `${rutaArriendo(idArriendo)}/integrantes?${consulta}`;
}

// ---------------------------------------------------------------------------
// Validación de la forma de las respuestas
// ---------------------------------------------------------------------------

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 1;
}

function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;
}

/** Texto opcional: ausente o null -> null; con tipo incorrecto -> undefined (respuesta inválida). */
function textoOpcional(valor: unknown): string | null | undefined {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") return undefined;
  return valor.trim() || null;
}

function esEstadoArriendo(valor: unknown): valor is EstadoArriendoDto {
  return valor === "Activo" || valor === "Finalizado";
}

function esRol(valor: unknown): valor is RolIntegranteDto {
  return valor === "Responsable" || valor === "Integrante";
}

function leerResponsable(esResponsable: unknown, rol: unknown): boolean | null | undefined {
  if (esResponsable !== undefined && typeof esResponsable !== "boolean") return null;
  if (rol !== undefined && rol !== null && !esRol(rol)) return null;
  const porRol = rol === "Responsable" ? true : rol === "Integrante" ? false : undefined;
  if (typeof esResponsable === "boolean" && porRol !== undefined && esResponsable !== porRol) return null;
  return typeof esResponsable === "boolean" ? esResponsable : porRol;
}

/**
 * Integrantes activos: contrato v2 `integrantes_activos`, base TI2 (18/11) `ocupacion`. Debe llegar al
 * menos uno; si llegan ambos deben coincidir. Devuelve null si falta, es inválido o se contradicen.
 */
function leerIntegrantesActivos(integrantesActivos: unknown, ocupacion: unknown): number | null {
  if (integrantesActivos !== undefined && !esEnteroNoNegativo(integrantesActivos)) return null;
  if (ocupacion !== undefined && !esEnteroNoNegativo(ocupacion)) return null;
  if (integrantesActivos !== undefined && ocupacion !== undefined && integrantesActivos !== ocupacion) return null;
  return ((integrantesActivos ?? ocupacion) as number | undefined) ?? null;
}

function esOrigen(valor: unknown): valor is OrigenArriendoDto {
  return valor === "Compartida" || valor === "Arrendador";
}

/**
 * Título y ubicación de una publicación (embebida en el detalle o devuelta por listado).
 * Es información de apoyo: un dato ilegible se descarta, nunca invalida el arriendo.
 */
export function leerTituloUbicacion(valor: unknown): { titulo: string | null; ubicacion: string | null } {
  if (!esObjeto(valor)) return { titulo: null, ubicacion: null };
  const titulo = typeof valor.titulo === "string" ? valor.titulo.trim() || null : null;
  let ubicacion = typeof valor.ubicacion === "string" ? valor.ubicacion.trim() || null : null;
  if (ubicacion === null) {
    // Contrato 4.1: region y comuna {id, nombre}; la ubicación textual se deriva de ellas.
    const nombres = [valor.comuna, valor.region]
      .map((parte) => (esObjeto(parte) && typeof parte.nombre === "string" ? parte.nombre.trim() : ""))
      .filter(Boolean);
    ubicacion = nombres.length > 0 ? nombres.join(", ") : null;
  }
  return { titulo, ubicacion };
}

/**
 * Referencia de GET /mio: solo se exige a qué arriendo se refiere (el `estado`, si llega, se valida).
 * `es_responsable` (relación de la sesión, contrato 6.1) es opcional.
 */
export function adaptarReferenciaArriendo(
  datos: unknown,
): { idArriendo: number; estado: EstadoArriendoDto; soyResponsable: boolean | null } | null {
  if (!esObjeto(datos)) return null;
  if (!esEnteroPositivo(datos.id_arriendo)) return null;
  // La base de TI2 (18/11) no trae `estado`: un 200 ya implica pertenencia activa.
  if (datos.estado !== undefined && !esEstadoArriendo(datos.estado)) return null;
  const soyResponsable = leerResponsable(datos.es_responsable, datos.rol);
  if (soyResponsable === null) return null;
  return {
    idArriendo: datos.id_arriendo,
    estado: datos.estado ?? "Activo",
    soyResponsable: soyResponsable === undefined ? null : soyResponsable,
  };
}

/** Datos del arriendo (contrato v2 6.3 o base TI2 18/11). Devuelve null ante cualquier campo ausente o incoherente. */
export function adaptarArriendo(datos: unknown): ArriendoVista | null {
  if (!esObjeto(datos)) return null;
  const dto = datos as Partial<Record<keyof ArriendoDto, unknown>>;

  if (!esEnteroPositivo(dto.id_arriendo) || !esEnteroPositivo(dto.id_publicacion)) return null;
  if (dto.estado !== undefined && !esEstadoArriendo(dto.estado)) return null;
  if (!esEnteroPositivo(dto.cupos_totales)) return null;
  const integrantesActivos = leerIntegrantesActivos(dto.integrantes_activos, dto.ocupacion);
  if (integrantesActivos === null) return null;
  // BR-15: los integrantes activos nunca superan los cupos totales.
  if (integrantesActivos > dto.cupos_totales) return null;
  if (dto.version_capacidad !== undefined && !esEnteroPositivo(dto.version_capacidad)) return null;

  // BR-14: cupos_disponibles = cupos_totales − integrantes_activos. Si el servidor no lo envía se calcula
  // con sus dos datos; un `null` explícito significa «no disponible» y no se reemplaza.
  let cuposDisponibles: number | null = dto.cupos_totales - integrantesActivos;
  if (dto.cupos_disponibles === null) {
    cuposDisponibles = null;
  } else if (dto.cupos_disponibles !== undefined) {
    if (!esEnteroNoNegativo(dto.cupos_disponibles) || dto.cupos_disponibles > dto.cupos_totales) return null;
    cuposDisponibles = dto.cupos_disponibles;
  }

  let origen: OrigenArriendoDto | null = null;
  if (dto.origen !== undefined && dto.origen !== null) {
    if (!esOrigen(dto.origen)) return null;
    origen = dto.origen;
  }

  if (dto.id_responsable !== undefined && dto.id_responsable !== null && !esEnteroPositivo(dto.id_responsable)) return null;
  const fechaInicio = textoOpcional(dto.fecha_inicio);
  const fechaFin = textoOpcional(dto.fecha_fin);
  if (fechaInicio === undefined || fechaFin === undefined) return null;

  const { titulo, ubicacion } = leerTituloUbicacion(dto.publicacion);

  return {
    idArriendo: dto.id_arriendo,
    idPublicacion: dto.id_publicacion,
    estado: dto.estado ?? "Activo",
    origen,
    titulo,
    ubicacion,
    cuposTotales: dto.cupos_totales,
    cuposDisponibles,
    integrantesActivos,
    fechaInicio,
    soyResponsable: null,
  };
}

function adaptarIntegrante(fila: unknown): IntegranteArriendoVista | "inactivo" | null {
  if (!esObjeto(fila)) return null;
  const dto = fila as Partial<Record<keyof IntegranteArriendoDto, unknown>>;

  if (!esEnteroPositivo(dto.id_usuario)) return null;
  const esResponsable = leerResponsable(dto.es_responsable, dto.rol);
  if (typeof esResponsable !== "boolean") return null;
  if (dto.es_yo !== undefined && typeof dto.es_yo !== "boolean") return null;
  const fechaSalida = textoOpcional(dto.fecha_salida);
  if (fechaSalida === undefined) return null;

  // Datos de la persona: planos o dentro de `usuario` (mismo patrón del resumen de conexiones, 5.1).
  const persona = esObjeto(dto.usuario) ? dto.usuario : dto;
  if (typeof persona.nombre !== "string" || !persona.nombre.trim()) return null;
  if (persona.foto !== undefined && persona.foto !== null && typeof persona.foto !== "string") return null;

  // Con fecha de salida la persona ya no reside: no se muestra aunque el filtro activos no se aplique.
  if (fechaSalida !== null) return "inactivo";

  return {
    idUsuario: dto.id_usuario,
    nombre: persona.nombre.trim(),
    fotoUrl: resolverUrlFoto(persona.foto as string | null | undefined),
    esResponsable,
    esPropio: dto.es_yo === true,
  };
}

/**
 * Integrantes: arreglo simple o {items, siguiente_cursor}. Una fila ilegible invalida toda la
 * respuesta: no se muestra una lista a medias.
 */
export function adaptarPaginaIntegrantes(
  datos: unknown,
): { integrantes: IntegranteArriendoVista[]; siguienteCursor: string | null } | null {
  let items: unknown;
  let siguienteCursor: string | null = null;

  if (Array.isArray(datos)) {
    items = datos;
  } else if (esObjeto(datos) && Array.isArray(datos.items)) {
    items = datos.items;
    const cursor = datos.siguiente_cursor;
    if (cursor !== undefined && cursor !== null) {
      // Cursor opaco: se valida forma y tamaño antes de reenviarlo.
      if (typeof cursor !== "string" || cursor.length < 1 || cursor.length > LARGO_MAX_CURSOR) return null;
      if (/[\s\u0000-\u001f\u007f]/.test(cursor)) return null;
      siguienteCursor = cursor;
    }
  } else {
    return null;
  }

  const integrantes: IntegranteArriendoVista[] = [];
  for (const fila of items as unknown[]) {
    const integrante = adaptarIntegrante(fila);
    if (integrante === null) return null;
    if (integrante !== "inactivo") integrantes.push(integrante);
  }
  return { integrantes, siguienteCursor };
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

function respuestaInvalida(estadoHttp: number): ErrorHttp {
  return {
    exito: false,
    codigo: "respuesta_invalida",
    error: "El servicio respondió algo que no pudimos interpretar.",
    estadoHttp,
  };
}

function sinPertenencia(estadoHttp?: number): SinPertenencia {
  return {
    exito: false,
    codigo: "sin_pertenencia",
    error: "No perteneces a un arriendo activo.",
    ...(estadoHttp === undefined ? {} : { estadoHttp }),
  };
}

/**
 * Código que el cliente HTTP copia del cuerpo del error (`code` o `codigo`; SCRUM-91, commit de Gustavo en
 * httpClient). Solo trae texto corto, nunca el mensaje del servidor. undefined si el servidor no mandó código.
 */
function codigoDelServicio(fallo: ErrorHttp): string | undefined {
  const valor = (fallo as ErrorHttp & { codigoServicio?: unknown }).codigoServicio;
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

/**
 * 404 es la señal contractual de "sin pertenencia" (contrato 6.1: «Mi arriendo activo (o 404)»;
 * 404 no_encontrado también cubre «el actor no puede saber que existe»). Cualquier otro fallo
 * (401, 403, 5xx, red, tiempo agotado) se propaga sin reinterpretar.
 */
function traducirFallo(fallo: ErrorHttp): ErrorHttp | SinPertenencia {
  if (fallo.codigo === "http" && fallo.estadoHttp === 404) {
    // Un 404 CON código lo respondió el servicio de arriendos (RENTAL_NOT_FOUND): no pertenece a ninguno.
    // Un 404 SIN código es el genérico del Gateway («Ruta no disponible»): la ruta aún no existe, y decirle
    // «no tienes arriendo» a todos ocultaría la falta de integración.
    if (codigoDelServicio(fallo) === undefined) {
      return { ...fallo, error: "El servicio de arriendos todavía no está disponible. Inténtalo más tarde." };
    }
    return sinPertenencia(404);
  }
  return fallo;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

type ResultadoIntegrantes =
  | { exito: true; integrantes: IntegranteArriendoVista[] | null; parcial: boolean }
  | ErrorHttp
  | SinPertenencia;

/** Lee las páginas de integrantes en orden, sin duplicados y sin seguir cursores repetidos. */
export async function consultarIntegrantes(
  idArriendo: number,
  enviar: EnviarArriendos = solicitarJson,
): Promise<ResultadoIntegrantes> {
  const porId = new Map<number, IntegranteArriendoVista>();
  const cursoresUsados = new Set<string>();
  let cursor: string | null = null;

  for (let pagina = 0; pagina < MAX_PAGINAS_INTEGRANTES; pagina++) {
    const respuesta = await enviar(rutaIntegrantes(idArriendo, LIMITE_PAGINA_INTEGRANTES, cursor));
    if (!respuesta.exito) {
      // /integrantes llega con F01 y hoy no existe en el servidor. La pertenencia ya se confirmó con /mio y el
      // detalle, así que un 404 en la primera página significa «lista no disponible», no «sin arriendo».
      if (pagina === 0 && respuesta.codigo === "http" && respuesta.estadoHttp === 404) {
        return { exito: true, integrantes: null, parcial: false };
      }
      return traducirFallo(respuesta);
    }

    const datos = adaptarPaginaIntegrantes(respuesta.datos);
    if (!datos) return respuestaInvalida(respuesta.estadoHttp);

    for (const integrante of datos.integrantes) {
      if (!porId.has(integrante.idUsuario)) porId.set(integrante.idUsuario, integrante);
    }

    if (datos.siguienteCursor === null) {
      return { exito: true, integrantes: [...porId.values()], parcial: false };
    }
    // Un cursor repetido indica un servicio que no avanza: no se sigue consultando.
    if (cursoresUsados.has(datos.siguienteCursor)) return respuestaInvalida(respuesta.estadoHttp);
    cursoresUsados.add(datos.siguienteCursor);
    cursor = datos.siguienteCursor;
  }
  return { exito: true, integrantes: [...porId.values()], parcial: true };
}

type ResultadoDetalle = { exito: true; arriendo: ArriendoVista } | ErrorHttp | SinPertenencia;

/**
 * Datos del arriendo y, si el detalle no trae el título, los de su publicación. Esa segunda
 * consulta es solo de apoyo: si falla, la pantalla se muestra con un rótulo genérico.
 */
async function consultarDetalle(
  mio: { idArriendo: number; soyResponsable: boolean | null },
  enviar: EnviarArriendos,
): Promise<ResultadoDetalle> {
  const respuesta = await enviar(rutaArriendo(mio.idArriendo));
  if (!respuesta.exito) return traducirFallo(respuesta);

  const arriendo = adaptarArriendo(respuesta.datos);
  // El detalle debe corresponder al arriendo pedido: no mezclar datos de otro recurso.
  if (!arriendo || arriendo.idArriendo !== mio.idArriendo) return respuestaInvalida(respuesta.estadoHttp);
  if (arriendo.estado !== "Activo") return sinPertenencia();

  let { titulo, ubicacion } = arriendo;
  if (titulo === null) {
    const publicacion = await enviar(rutaPublicacion(arriendo.idPublicacion));
    // Se ignora una respuesta que no corresponda a la publicación del arriendo.
    const coincide = publicacion.exito
      && !(esObjeto(publicacion.datos)
        && publicacion.datos.id_publicacion !== undefined
        && publicacion.datos.id_publicacion !== arriendo.idPublicacion);
    if (publicacion.exito && coincide) {
      const datos = leerTituloUbicacion(publicacion.datos);
      titulo = datos.titulo;
      ubicacion = ubicacion ?? datos.ubicacion;
    }
  }

  return { exito: true, arriendo: { ...arriendo, titulo, ubicacion, soyResponsable: mio.soyResponsable } };
}

/**
 * Carga completa de "Mi arriendo": referencia (/mio), luego detalle e integrantes en paralelo.
 * - 404 en /mio o en el detalle -> sin_pertenencia (el arriendo dejó de ser de la persona).
 * - 404 en la primera página de /integrantes -> lista no disponible (integrantes: null), no sin_pertenencia.
 * - Un arriendo que no está "Activo" no es "Mi arriendo": también es sin_pertenencia.
 * - 401/403/5xx/red/tiempo agotado -> el ErrorHttp original, para que la pantalla decida.
 */
export async function consultarMiArriendo(
  enviarBase: EnviarArriendos = solicitarJson,
  identidadEsperada?: string,
): Promise<ResultadoMiArriendo> {
  // Con `identidadEsperada` (A01), cada petición sale solo si la sesión sigue siendo de esa cuenta: una
  // consulta iniciada por la cuenta A nunca viaja con el token de la cuenta B.
  const enviar: EnviarArriendos = identidadEsperada === undefined
    ? enviarBase
    : (ruta, opciones) => enviarBase(ruta, { ...opciones, identidadEsperada });

  const referencia = await enviar(RUTA_MI_ARRIENDO);
  if (!referencia.exito) return traducirFallo(referencia);

  const mio = adaptarReferenciaArriendo(referencia.datos);
  if (!mio) return respuestaInvalida(referencia.estadoHttp);
  if (mio.estado !== "Activo") return sinPertenencia();

  const [detalle, integrantes] = await Promise.all([
    consultarDetalle(mio, enviar),
    consultarIntegrantes(mio.idArriendo, enviar),
  ]);

  if (!detalle.exito) return detalle;
  if (!integrantes.exito) return integrantes;

  return {
    exito: true,
    arriendo: detalle.arriendo,
    integrantes: integrantes.integrantes,
    integrantesParciales: integrantes.parcial,
  };
}
