import { adaptarPublicacionPropia } from "@/adapters/publicacionPropiaAdapter";
import { ENVIAR_ENLACE_REFERENCIA } from "@/constants/camposPublicacion";
import {
  CAMPOS_API_PUBLICACION,
  CAMPO_REGLAS_LISTADO,
  CATEGORIA_LISTADO,
  ESTADO_HTTP_CREADA,
  MAX_LARGO_UBICACION,
  MAX_CARACTERES_REGLA,
  MAX_IMAGENES_ARRENDADOR,
  MAX_REGLAS_ARRENDADOR,
  PRECIO_MAXIMO,
  TIPO_VIVIENDA_API,
  TIPO_VIVIENDA_API_LISTADO,
} from "@/constants/contratoPublicacion";
import { solicitarFormulario, solicitarJson } from "@/services/httpClient";
import { publicacionesMock } from "@/mocks/publicaciones";
import type { ErrorHttp } from "@/types/Http";
import type {
  PublicacionArrendadorCreateDto,
  PublicacionCompartidaCreateDto,
  PublicacionCreadaResponse,
  PublicacionCreateBaseDto,
} from "@/types/api/PublicacionCreateDto";
import type {
  FormularioPublicacionValores,
  TipoPublicacion,
  TipoVivienda,
  Publicacion,
} from "@/types/Publicacion";
import type { PublicacionPropia } from "@/types/PublicacionPropia";

// Las banderas ENVIAR_* viven en constants/camposPublicacion.ts: también las usan
// el formulario y la vista previa.
export { ENVIAR_ENLACE_REFERENCIA };

// Servicio de publicaciones. Este archivo es compartido con la búsqueda
// (M4-B07, M4-B08): las funciones de listado y detalle se agregan aquí, no en
// un segundo servicio. Aquí vive la creación; B08-B10 conservan por ahora
// su fuente demostrativa hasta confirmar y conectar el contrato de consulta.
//
// Las llamadas salen por el cliente HTTP único (`solicitarFormulario`, M4-A07), que
// agrega el Bearer de la sesión de Supabase. Ese cliente nunca lanza: aquí tampoco; el resultado es
// `exito: true` con los datos, o el `ErrorHttp` tal cual.
//
// CONTRATO (Contrato de microservicios, cap. 4.1): la creación es UNA sola ruta,
// POST /api/publicaciones, con un FORMULARIO (multipart). El origen va en el campo
// `tipo`. Responde 201 con la publicación en estado Disponible; cualquier otro estado
// (aunque sea 2xx) NO se trata como creación.

// Rutas (endpoints). Hoy son la misma; se deja por origen para separarlas con un
// solo cambio si TI2 crea rutas distintas.
export const RUTA_CREAR_PUBLICACION: Record<TipoPublicacion, string> = {
  Arrendador: "/api/publicaciones",
  Compartida: "/api/publicaciones",
};

/**
 * Lo que se usa de `solicitarFormulario` (M4-A07). La creación se envía como
 * multipart (FormData en `cuerpo`), no como JSON. Las pruebas pueden pasar una versión
 * simulada.
 */
export type EnviarFormulario = typeof solicitarFormulario;

export type ResultadoCreacionPublicacion =
  | { exito: true; datos: PublicacionCreadaResponse; estadoHttp: number }
  | ErrorHttp;

/** Ruta y body ya armados para un origen. */
export type SolicitudCreacionPublicacion =
  | { origen: "Arrendador"; ruta: string; cuerpo: PublicacionArrendadorCreateDto }
  | { origen: "Compartida"; ruta: string; cuerpo: PublicacionCompartidaCreateDto };

/** El formulario llegó con datos que no se pueden convertir en un payload. */
export class PayloadPublicacionInvalidoError extends Error {
  readonly campo: keyof FormularioPublicacionValores;

  constructor(campo: keyof FormularioPublicacionValores) {
    super(`No se puede armar la solicitud: el campo "${campo}" no es válido.`);
    this.name = "PayloadPublicacionInvalidoError";
    this.campo = campo;
  }
}

function textoObligatorio(
  valores: FormularioPublicacionValores,
  campo: "titulo" | "descripcion",
): string {
  const texto = valores[campo].trim();
  if (!texto) throw new PayloadPublicacionInvalidoError(campo);
  return texto;
}

function tipoViviendaObligatorio(
  valores: FormularioPublicacionValores,
): TipoVivienda {
  if (!valores.tipoVivienda) throw new PayloadPublicacionInvalidoError("tipoVivienda");
  return valores.tipoVivienda;
}

// El formulario guarda los números como texto de solo dígitos. Se convierten aquí y
// se rechaza todo lo demás para que nunca se serialice un NaN.
function enteroEnRango(
  texto: string,
  campo: keyof FormularioPublicacionValores,
  minimo: number,
  maximo: number,
): number {
  const limpio = texto.trim();
  const numero = Number(limpio);
  if (!/^\d+$/.test(limpio) || !Number.isSafeInteger(numero) || numero < minimo || numero > maximo) {
    throw new PayloadPublicacionInvalidoError(campo);
  }
  return numero;
}

// Reglas del arrendador: se descartan las vacías; máx. 20 de máx. 300 caracteres.
function reglasLimpias(valores: FormularioPublicacionValores): string[] {
  const reglas = valores.reglas.map((regla) => regla.trim()).filter(Boolean);
  if (reglas.length > MAX_REGLAS_ARRENDADOR || reglas.some((r) => r.length > MAX_CARACTERES_REGLA)) {
    throw new PayloadPublicacionInvalidoError("reglas");
  }
  return reglas;
}

// Forma que hoy valida Listado (ver constants/contratoPublicacion.ts), distinta del
// contrato v2. `ubicacion` se deriva de los nombres elegidos en el selector
// ("Temuco, La Araucanía").
function formaListadoArrendador(
  valores: FormularioPublicacionValores,
  base: PublicacionCreateBaseDto,
  reglas: string[],
): PublicacionArrendadorCreateDto {
  const ubicacion = [valores.nombreComuna, valores.nombreRegion]
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(", ")
    .slice(0, MAX_LARGO_UBICACION);
  if (!ubicacion) throw new PayloadPublicacionInvalidoError("nombreComuna");
  return {
    ...base,
    tipo_vivienda: TIPO_VIVIENDA_API_LISTADO[tipoViviendaObligatorio(valores)],
    tipo: "Arrendador",
    categoria: CATEGORIA_LISTADO,
    ubicacion,
    ...(reglas.length > 0 ? { [CAMPO_REGLAS_LISTADO]: reglas } : {}),
  };
}

/**
 * Transforma el estado del formulario en la solicitud: nombres en snake_case,
 * números como número y el origen en `tipo`.
 *
 * Función pura: no envía nada. Asume un formulario que ya pasó
 * `validarFormularioPublicacion` y lanza `PayloadPublicacionInvalidoError`
 * si no es así. Las reglas de negocio las valida el backend.
 */
export function armarSolicitudCreacion(
  valores: FormularioPublicacionValores,
): SolicitudCreacionPublicacion {
  const base: PublicacionCreateBaseDto = {
    titulo: textoObligatorio(valores, "titulo"),
    descripcion: textoObligatorio(valores, "descripcion"),
    precio: enteroEnRango(valores.precio, "precio", 0, PRECIO_MAXIMO),
    id_region: enteroEnRango(valores.idRegion, "idRegion", 1, Number.MAX_SAFE_INTEGER),
    id_comuna: enteroEnRango(valores.idComuna, "idComuna", 1, Number.MAX_SAFE_INTEGER),
    tipo_vivienda: TIPO_VIVIENDA_API[tipoViviendaObligatorio(valores)],
    cupos_totales: enteroEnRango(valores.cupos, "cupos", 1, 2_147_483_647),
    mascota: valores.aceptaMascotas ? "si" : "no",
  };

  if (valores.tipo === "Arrendador") {
    const reglas = reglasLimpias(valores);
    return {
      origen: "Arrendador",
      ruta: RUTA_CREAR_PUBLICACION.Arrendador,
      cuerpo: formaListadoArrendador(valores, base, reglas),
    };
  }

  const enlace = valores.enlaceReferencia.trim();
  return {
    origen: "Compartida",
    ruta: RUTA_CREAR_PUBLICACION.Compartida,
    cuerpo: {
      ...base,
      tipo: "Compartida",
      ...(ENVIAR_ENLACE_REFERENCIA && enlace ? { enlace_referencia: enlace } : {}),
    },
  };
}

/**
 * Pasa el body a los campos del formulario multipart. El servidor lee todo como
 * texto: números y booleanos se escriben como texto ("true"/"false" para
 * `permitir_comentarios`), las listas como JSON y lo que no tiene valor se omite.
 * Función pura sobre el body ya armado; no valida nada.
 */
export function cuerpoAFormulario(cuerpo: object): FormData {
  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(cuerpo)) {
    if (valor === undefined || valor === null) continue;
    formulario.append(
      campo,
      Array.isArray(valor) ? JSON.stringify(valor) : String(valor),
    );
  }
  return formulario;
}

const TIPOS_IMAGEN: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// El contrato acepta varias imágenes repitiendo el campo `imagenes` (JPG, PNG o WEBP,
// máx. 5 MB c/u, hasta 5 en Arrendador); el servidor las valida. React Native acepta
// { uri, name, type } como archivo en FormData nativo. La primera es la portada.
function adjuntarImagenes(formulario: FormData, uris: string[]): void {
  uris.forEach((uri, i) => {
    const extension = uri.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    const conocida = extension in TIPOS_IMAGEN;
    formulario.append(CAMPOS_API_PUBLICACION.imagenes, {
      uri,
      name: `foto-${i + 1}.${conocida ? extension : "jpg"}`,
      type: conocida ? TIPOS_IMAGEN[extension] : "image/jpeg",
    } as unknown as Blob);
  });
}

// `datos` llega como unknown: JSON válido no es una respuesta válida. El contrato
// responde la publicación con `id_publicacion`; se acepta `id` por compatibilidad.
function leerPublicacionCreada(datos: unknown): PublicacionCreadaResponse | null {
  if (typeof datos !== "object" || datos === null) return null;
  const registro = datos as Record<string, unknown>;
  const id = registro.id_publicacion ?? registro.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) return null;
  const mensaje = registro.mensaje;
  return typeof mensaje === "string" ? { id, mensaje } : { id };
}

export interface OpcionesCreacion {
  /** Fotos del borrador (URIs locales); se envían todas bajo `imagenes`. */
  imagenesUris?: string[];
  /** Idempotency-Key del borrador, reutilizada en los reintentos. */
  claveIdempotencia?: string;
}

async function enviarSolicitud(
  solicitud: SolicitudCreacionPublicacion,
  enviar: EnviarFormulario,
  opciones: OpcionesCreacion,
): Promise<ResultadoCreacionPublicacion> {
  const formulario = cuerpoAFormulario(solicitud.cuerpo);
  if (opciones.imagenesUris?.length) adjuntarImagenes(formulario, opciones.imagenesUris);

  const resultado = await enviar(solicitud.ruta, {
    metodo: "POST",
    cuerpo: formulario,
    ...(opciones.claveIdempotencia
      ? { headers: { "Idempotency-Key": opciones.claveIdempotencia } }
      : {}),
  });
  if (!resultado.exito) return resultado;

  // Solo 201 es "creada". Un 200/202/204 no confirma que exista la publicación.
  if (resultado.estadoHttp !== ESTADO_HTTP_CREADA) {
    return {
      exito: false,
      codigo: "respuesta_invalida",
      error: "El servicio no confirmó la creación de la publicación.",
      estadoHttp: resultado.estadoHttp,
    };
  }

  const creada = leerPublicacionCreada(resultado.datos);
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

/**
 * Crea la publicación (la usa M4S3-C01). Éxito = 201 con una publicación válida.
 */
export async function crearPublicacion(
  valores: FormularioPublicacionValores,
  enviar: EnviarFormulario = solicitarFormulario,
  opciones: OpcionesCreacion = {},
): Promise<ResultadoCreacionPublicacion> {
  let solicitud: SolicitudCreacionPublicacion;
  try {
    solicitud = armarSolicitudCreacion(valores);
  } catch (error) {
    if (error instanceof PayloadPublicacionInvalidoError) {
      return {
        exito: false,
        codigo: "peticion_invalida",
        error: "Revisa los datos de la publicación antes de enviarla.",
      };
    }
    throw error;
  }
  if ((opciones.imagenesUris?.length ?? 0) > MAX_IMAGENES_ARRENDADOR) {
    return {
      exito: false,
      codigo: "peticion_invalida",
      error: `Puedes subir hasta ${MAX_IMAGENES_ARRENDADOR} fotos.`,
    };
  }
  return enviarSolicitud(solicitud, enviar, opciones);
}

export type SolicitarJson = typeof solicitarJson;

export type ResultadoDetalleCreada =
  | { exito: true; idPublicacion: number; estado: string | null }
  | ErrorHttp;

/**
 * Consulta GET /api/publicaciones/{id} tras la creación para confirmar que existe.
 * Solo comprueba la respuesta mínima (id y estado); el modelo completo del detalle
 * lo arma el servicio de consulta (B03). No reintenta ni crea nada.
 */
export async function consultarPublicacionCreada(
  id: number,
  solicitar: SolicitarJson = solicitarJson,
): Promise<ResultadoDetalleCreada> {
  if (!Number.isSafeInteger(id) || id < 1) {
    return { exito: false, codigo: "peticion_invalida", error: "La publicación no es válida." };
  }
  const resultado = await solicitar(`/api/publicaciones/${id}`, { autenticada: false });
  if (!resultado.exito) return resultado;
  const datos = resultado.datos as Record<string, unknown> | null;
  const idRecibido = datos && typeof datos === "object" ? (datos.id_publicacion ?? datos.id) : undefined;
  if (idRecibido !== id) {
    return {
      exito: false,
      codigo: "respuesta_invalida",
      error: "El servicio devolvió una publicación distinta a la creada.",
      estadoHttp: resultado.estadoHttp,
    };
  }
  return {
    exito: true,
    idPublicacion: id,
    estado: typeof datos?.estado === "string" ? datos.estado : null,
  };
}

export interface FiltrosArriendo {
  precioMin?: number;
  precioMax?: number;
  comuna?: string;
  habitaciones?: number;
}

/**
 * Fuente demostrativa de B08/B09. No envía solicitudes ni simula una sesión.
 * La consulta real deberá usar solicitarJson del cliente HTTP autenticado.
 * `habitaciones` queda pendiente: el modelo local no entrega ese dato.
 */
export async function obtenerPublicaciones(filtros: FiltrosArriendo = {}): Promise<Publicacion[]> {
  const zona = filtros.comuna?.trim().toLocaleLowerCase("es-CL");
  return publicacionesMock.filter((publicacion) =>
    (filtros.precioMin === undefined || publicacion.precio >= filtros.precioMin) &&
    (filtros.precioMax === undefined || publicacion.precio <= filtros.precioMax) &&
    (!zona || publicacion.ubicacion.toLocaleLowerCase("es-CL").includes(zona)),
  );
}

/** Detalle demostrativo de B10; comparte los IDs y la fuente del listado. */
export async function obtenerPublicacionPorId(id: string | number): Promise<Publicacion | null> {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero < 1) return null;
  return publicacionesMock.find((publicacion) => publicacion.idPublicacion === numero) ?? null;
}

// ---------------------------------------------------------------------------
// M4S3-C02: Mis publicaciones, edición y cierre
// ---------------------------------------------------------------------------
// GET /api/publicaciones/mias · GET /api/publicaciones/{id} ·
// PUT /api/publicaciones/{id} (multipart) · PATCH /api/publicaciones/{id}/cerrar.
// La forma de la respuesta se interpreta solo en adapters/publicacionPropiaAdapter.ts.
// Igual que la creación: nunca lanzan; devuelven datos o el `ErrorHttp` tal cual.

const respuestaIlegible = (error: string, estadoHttp: number): ErrorHttp => ({
  exito: false,
  codigo: "respuesta_invalida",
  error,
  estadoHttp,
});

const idValido = (id: number) => Number.isSafeInteger(id) && id >= 1;

const publicacionNoValida = (): ErrorHttp => ({
  exito: false,
  codigo: "peticion_invalida",
  error: "La publicación no es válida.",
});

export interface PaginaPublicacionesPropias {
  items: PublicacionPropia[];
  /** null cuando no hay más páginas. El cursor es opaco: se devuelve tal cual. */
  siguienteCursor: string | null;
}

export type ResultadoMisPublicaciones =
  | { exito: true; datos: PaginaPublicacionesPropias; estadoHttp: number }
  | ErrorHttp;

/**
 * Una página de mis publicaciones (todos los estados, incluidas las cerradas). El
 * servicio todavía no filtra por estado: el filtro se aplica en el cliente (hook).
 */
export async function listarMisPublicaciones(
  opciones: { cursor?: string | null; limite?: number } = {},
  solicitar: SolicitarJson = solicitarJson,
): Promise<ResultadoMisPublicaciones> {
  const limite = opciones.limite ?? 20;
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
    return { exito: false, codigo: "peticion_invalida", error: "El tamaño de página no es válido." };
  }
  const parametros = new URLSearchParams({ limite: String(limite) });
  if (opciones.cursor) parametros.set("cursor", opciones.cursor);

  const resultado = await solicitar(`/api/publicaciones/mias?${parametros.toString()}`);
  if (!resultado.exito) return resultado;

  const cuerpo = resultado.datos as { items?: unknown; siguiente_cursor?: unknown } | null;
  const cursor = cuerpo?.siguiente_cursor;
  if (
    typeof cuerpo !== "object" || cuerpo === null ||
    !Array.isArray(cuerpo.items) ||
    !(cursor === null || (typeof cursor === "string" && cursor.length > 0))
  ) {
    return respuestaIlegible("El servicio devolvió una lista que no pudimos interpretar.", resultado.estadoHttp);
  }

  const items: PublicacionPropia[] = [];
  for (const crudo of cuerpo.items) {
    const publicacion = adaptarPublicacionPropia(crudo);
    if (!publicacion) {
      return respuestaIlegible("El servicio devolvió una publicación que no pudimos interpretar.", resultado.estadoHttp);
    }
    items.push(publicacion);
  }
  return { exito: true, datos: { items, siguienteCursor: cursor }, estadoHttp: resultado.estadoHttp };
}

export type ResultadoPublicacionPropia =
  | { exito: true; datos: PublicacionPropia; estadoHttp: number }
  | ErrorHttp;

function leerPublicacionPropia(
  resultado: { datos: unknown; estadoHttp: number },
  idEsperado: number,
): ResultadoPublicacionPropia {
  const publicacion = adaptarPublicacionPropia(resultado.datos);
  if (!publicacion || publicacion.idPublicacion !== idEsperado) {
    return respuestaIlegible("El servicio devolvió una publicación que no pudimos interpretar.", resultado.estadoHttp);
  }
  return { exito: true, datos: publicacion, estadoHttp: resultado.estadoHttp };
}

/** Detalle completo para editar. Con sesión: el dueño puede recibir campos extra (id_arriendo). */
export async function consultarPublicacionPropia(
  id: number,
  solicitar: SolicitarJson = solicitarJson,
): Promise<ResultadoPublicacionPropia> {
  if (!idValido(id)) return publicacionNoValida();
  const resultado = await solicitar(`/api/publicaciones/${id}`);
  if (!resultado.exito) return resultado;
  return leerPublicacionPropia(resultado, id);
}

export interface OpcionesEdicion {
  /** `id_imagen` de las fotos que se conservan, en el orden deseado (puede ir vacío). */
  idsConservados: number[];
  /** Fotos nuevas (URIs locales). Conservadas + nuevas: máximo 5. */
  nuevasUris: string[];
  /**
   * Idempotency-Key de ESTA edición: se reutiliza al reintentar el mismo cambio y se
   * cambia si cambia el contenido (otro cuerpo con la misma clave responde 409).
   */
  claveIdempotencia: string;
}

export type ResultadoEdicionPublicacion =
  | { exito: true; idPublicacion: number; publicacion: PublicacionPropia | null; estadoHttp: number }
  | ErrorHttp;

/**
 * Edita una publicación de arrendador (PUT multipart). El tipo no cambia. Siempre se
 * envía `imagenes_conservar` explícito: omitirlo conservaría todas las vigentes y
 * quitar una foto nunca llegaría al servidor. Las reglas de capacidad y de reglas
 * congeladas las decide la API (409).
 */
export async function editarPublicacion(
  id: number,
  valores: FormularioPublicacionValores,
  opciones: OpcionesEdicion,
  enviar: EnviarFormulario = solicitarFormulario,
): Promise<ResultadoEdicionPublicacion> {
  if (!idValido(id)) return publicacionNoValida();

  const conservados = opciones.idsConservados;
  if (
    conservados.some((valor) => !idValido(valor)) ||
    new Set(conservados).size !== conservados.length
  ) {
    return { exito: false, codigo: "peticion_invalida", error: "Las fotos conservadas no son válidas." };
  }
  if (conservados.length + opciones.nuevasUris.length > MAX_IMAGENES_ARRENDADOR) {
    return {
      exito: false,
      codigo: "peticion_invalida",
      error: `Puedes tener hasta ${MAX_IMAGENES_ARRENDADOR} fotos.`,
    };
  }

  let solicitud: SolicitudCreacionPublicacion;
  try {
    solicitud = armarSolicitudCreacion(valores);
  } catch (error) {
    if (error instanceof PayloadPublicacionInvalidoError) {
      return {
        exito: false,
        codigo: "peticion_invalida",
        error: "Revisa los datos de la publicación antes de guardarla.",
      };
    }
    throw error;
  }
  if (solicitud.origen !== "Arrendador") {
    return {
      exito: false,
      codigo: "peticion_invalida",
      error: "Solo se pueden editar publicaciones de arrendador.",
    };
  }

  const formulario = cuerpoAFormulario(solicitud.cuerpo);
  // Listado conserva las reglas guardadas cuando el PUT no trae el campo. Si la persona
  // quitó todas, hay que enviarlas vacías: omitirlas dejaría las anteriores.
  if (!(CAMPO_REGLAS_LISTADO in solicitud.cuerpo)) formulario.append(CAMPO_REGLAS_LISTADO, "[]");
  formulario.append("imagenes_conservar", JSON.stringify(conservados));
  adjuntarImagenes(formulario, opciones.nuevasUris);

  const resultado = await enviar(`/api/publicaciones/${id}`, {
    metodo: "PUT",
    cuerpo: formulario,
    headers: { "Idempotency-Key": opciones.claveIdempotencia },
  });
  if (!resultado.exito) return resultado;

  // Solo 200 confirma el cambio; cualquier otro 2xx no se toma como guardado.
  if (resultado.estadoHttp !== 200) {
    return respuestaIlegible("El servicio no confirmó los cambios de la publicación.", resultado.estadoHttp);
  }
  const confirmada = leerPublicacionPropia(resultado, id);
  if (!confirmada.exito) return confirmada;
  return {
    exito: true,
    idPublicacion: id,
    publicacion: confirmada.datos,
    estadoHttp: resultado.estadoHttp,
  };
}

export type ResultadoCierrePublicacion = ResultadoPublicacionPropia;

/**
 * Cierra la publicación (PATCH). Es idempotente: cerrar una cerrada responde igual.
 * Éxito solo si la respuesta confirma estado Cerrada.
 */
export async function cerrarPublicacion(
  id: number,
  solicitar: SolicitarJson = solicitarJson,
): Promise<ResultadoCierrePublicacion> {
  if (!idValido(id)) return publicacionNoValida();
  const resultado = await solicitar(`/api/publicaciones/${id}/cerrar`, { metodo: "PATCH" });
  if (!resultado.exito) return resultado;
  const cerrada = leerPublicacionPropia(resultado, id);
  if (cerrada.exito && cerrada.datos.estado !== "Cerrada") {
    return respuestaIlegible("El servicio no confirmó el cierre de la publicación.", resultado.estadoHttp);
  }
  return cerrada;
}
