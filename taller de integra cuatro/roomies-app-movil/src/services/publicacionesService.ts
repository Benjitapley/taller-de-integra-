import { ENVIAR_DETALLE_MASCOTAS, ENVIAR_ENLACE_REFERENCIA } from "@/constants/camposPublicacion";
import { solicitarFormulario, solicitarJson } from "@/services/httpClient";
import { adaptarPublicacionListado } from "@/adapters/publicacionAdapter";
import { publicacionesMock } from "@/mocks/publicaciones";
import type { ErrorHttp } from "@/types/Http";
import type {
  CategoriaPublicacionDto,
  PublicacionArrendadorCreateDto,
  PublicacionCompartidaCreateDto,
  PublicacionCreadaResponse,
  PublicacionCreateBaseDto,
} from "@/types/api/PublicacionCreateDto";
import type {
  FormularioPublicacionValores,
  TipoMascota,
  TipoPublicacion,
  TipoVivienda,
  Publicacion,
} from "@/types/Publicacion";

// Las banderas ENVIAR_* viven en constants/camposPublicacion.ts: también las usan
// el formulario y la vista previa.
export { ENVIAR_DETALLE_MASCOTAS, ENVIAR_ENLACE_REFERENCIA };

// Servicio de publicaciones. Este archivo es compartido con la búsqueda
// (M4-B07, M4-B08): las funciones de listado y detalle se agregan aquí, no en
// un segundo servicio. M4-C07 cubre la creación; B08-B10 conservan por ahora
// su fuente demostrativa hasta confirmar y conectar el contrato de consulta.
//
// Las llamadas salen por el cliente HTTP único (`solicitarFormulario`, M4-A07), que
// agrega el Bearer de la sesión de Supabase. Ese cliente nunca lanza: aquí tampoco; el resultado es
// `exito: true` con los datos, o el `ErrorHttp` tal cual.
//
// CONTRATO REAL (listado-applications-service, app/api/routes.py): la creación
// es UNA sola ruta, POST /api/publicaciones, y recibe un FORMULARIO (multipart),
// no JSON. El origen va en el campo `tipo`, no en la ruta. Las rutas separadas
// /publicaciones/arrendador y /compartidas del backlog no existen.

// Rutas (endpoints). Hoy son la misma; se deja por origen para separarlas con un
// solo cambio si TI2 crea las rutas del backlog.
export const RUTA_CREAR_PUBLICACION: Record<TipoPublicacion, string> = {
  Arrendador: "/api/publicaciones",
  Compartida: "/api/publicaciones",
};

/**
 * La API pide `categoria` ("busco" | "ofrezco") además del origen. En la app
 * son lo mismo: quien publica un arriendo lo ofrece; quien comparte una
 * oportunidad busca con quién arrendarla.
 */
export const CATEGORIA_POR_ORIGEN: Record<TipoPublicacion, CategoriaPublicacionDto> = {
  Arrendador: "ofrezco",
  Compartida: "busco",
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
  campo: "titulo" | "descripcion" | "ubicacion",
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

// El formulario guarda precio y cupos como texto de solo dígitos. Se convierten
// aquí y se rechaza todo lo demás para que nunca se serialice un NaN (que JSON
// convierte en null sin avisar).
function enteroPositivo(
  valores: FormularioPublicacionValores,
  campo: "precio" | "cupos",
): number {
  const texto = valores[campo].trim();
  const numero = Number(texto);
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(numero) || numero < 1) {
    throw new PayloadPublicacionInvalidoError(campo);
  }
  return numero;
}


// Si no se aceptan mascotas, la lista y las condiciones del formulario se
// ignoran aunque la persona las haya llenado antes de apagar el interruptor.
function datosMascotas(
  valores: FormularioPublicacionValores,
): Pick<
  PublicacionCreateBaseDto,
  "mascota" | "tipos_mascotas_aceptadas" | "condiciones_mascotas"
> {
  if (!valores.aceptaMascotas) {
    return ENVIAR_DETALLE_MASCOTAS
      ? { mascota: "no", tipos_mascotas_aceptadas: [] }
      : { mascota: "no" };
  }

  // Con el detalle apagado basta "si"; el formulario ya validó lo demás.
  if (!ENVIAR_DETALLE_MASCOTAS) return { mascota: "si" };

  const tipos: TipoMascota[] = Array.from(new Set(valores.tiposMascotas));
  if (tipos.length === 0) throw new PayloadPublicacionInvalidoError("tiposMascotas");

  const condiciones = valores.condicionesMascotas.trim();
  if (tipos.includes("otro") && !condiciones) {
    throw new PayloadPublicacionInvalidoError("condicionesMascotas");
  }

  return {
    mascota: "si",
    tipos_mascotas_aceptadas: tipos,
    ...(condiciones ? { condiciones_mascotas: condiciones } : {}),
  };
}

/**
 * Transforma el estado del formulario en la solicitud: nombres en snake_case,
 * números como número y el origen en `tipo` (que el servicio exige).
 *
 * Función pura: no envía nada. Asume un formulario que ya pasó
 * `validarFormularioPublicacion` y lanza `PayloadPublicacionInvalidoError`
 * si no es así. Las reglas de negocio (límite de cupos activos, etc.) las
 * valida el backend.
 */
export function armarSolicitudCreacion(
  valores: FormularioPublicacionValores,
): SolicitudCreacionPublicacion {
  const base: PublicacionCreateBaseDto = {
    titulo: textoObligatorio(valores, "titulo"),
    descripcion: textoObligatorio(valores, "descripcion"),
    precio: enteroPositivo(valores, "precio"),
    ubicacion: textoObligatorio(valores, "ubicacion"),
    categoria: CATEGORIA_POR_ORIGEN[valores.tipo],
    tipo_vivienda: tipoViviendaObligatorio(valores),
    cupos_totales: enteroPositivo(valores, "cupos"),
    ...datosMascotas(valores),
    permitir_comentarios: valores.permitirComentarios,
  };

  if (valores.tipo === "Arrendador") {
    return {
      origen: "Arrendador",
      ruta: RUTA_CREAR_PUBLICACION.Arrendador,
      cuerpo: { ...base, tipo: "Arrendador" },
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

// El servicio acepta UNA imagen en el campo `imagen` (JPG, PNG o WEBP, máx. 5 MB)
// y la valida él mismo. React Native acepta { uri, name, type } como archivo.
function adjuntarImagen(formulario: FormData, uri: string): void {
  const extension = uri.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const conocida = extension in TIPOS_IMAGEN;
  formulario.append("imagen", {
    uri,
    name: `foto.${conocida ? extension : "jpg"}`,
    type: conocida ? TIPOS_IMAGEN[extension] : "image/jpeg",
  } as unknown as Blob);
}

// `datos` llega como unknown: JSON válido no es una respuesta válida.
function leerPublicacionCreada(datos: unknown): PublicacionCreadaResponse | null {
  if (typeof datos !== "object" || datos === null) return null;
  const { id, mensaje } = datos as Record<string, unknown>;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) return null;
  return typeof mensaje === "string" ? { id, mensaje } : { id };
}

async function enviarSolicitud(
  solicitud: SolicitudCreacionPublicacion,
  enviar: EnviarFormulario,
  imagenUri?: string,
): Promise<ResultadoCreacionPublicacion> {
  const formulario = cuerpoAFormulario(solicitud.cuerpo);
  if (imagenUri) adjuntarImagen(formulario, imagenUri);

  const resultado = await enviar(solicitud.ruta, {
    metodo: "POST",
    cuerpo: formulario,
  });
  if (!resultado.exito) return resultado;

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
 * Crea la publicación según el origen del formulario (la usa M4-C08).
 * `imagenUri`: foto principal opcional; el servicio guarda una sola imagen.
 */
export async function crearPublicacion(
  valores: FormularioPublicacionValores,
  enviar: EnviarFormulario = solicitarFormulario,
  imagenUri?: string,
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
  return enviarSolicitud(solicitud, enviar, imagenUri);
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

/**
 * Detalle real: GET /api/publicaciones/{id}/detalle (público, vía Gateway).
 * Devuelve null si la publicación no existe (404) y lanza un Error si falla la
 * conexión o la respuesta no tiene el formato esperado (la pantalla ofrece Reintentar).
 */
export async function obtenerPublicacionPorId(id: string | number): Promise<Publicacion | null> {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero < 1) return null;

  const resultado = await solicitarJson(`/api/publicaciones/${numero}/detalle`, { autenticada: false });
  if (!resultado.exito) {
    if (resultado.estadoHttp === 404) return null;
    throw new Error(resultado.error);
  }

  // Las imágenes pueden estar en otro servidor que el Gateway.
  // (Referencias estáticas: así Expo incluye los valores del entorno.)
  const urlBase =
    process.env.EXPO_PUBLIC_IMAGENES_URL?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim() || "";
  const publicacion = adaptarPublicacionListado(resultado.datos, urlBase);
  if (!publicacion) {
    throw new Error("El servicio devolvió la publicación en un formato que la app no reconoce.");
  }
  return publicacion;
}

export interface CuposPublicacion {
  estado: string;
  cuposTotales: number;
  cuposDisponibles: number;
}

export async function obtenerCuposPublicacion(
  id: string | number,
): Promise<CuposPublicacion> {
  const numero = Number(id);

  if (!Number.isSafeInteger(numero) || numero < 1) {
    throw new Error("El ID de la publicación no es válido.");
  }

  const resultado = await solicitarJson(
    `/api/publicaciones/${numero}/cupos`,
    { autenticada: false },
  );

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const datos = resultado.datos as Record<string, unknown>;

  if (
    typeof datos.estado !== "string" ||
    typeof datos.cupos_totales !== "number" ||
    typeof datos.cupos_disponibles !== "number"
  ) {
    throw new Error("El servicio devolvió los cupos en un formato inesperado.");
  }

  return {
    estado: datos.estado,
    cuposTotales: datos.cupos_totales,
    cuposDisponibles: datos.cupos_disponibles,
  };
}


export const TAMANO_PAGINA = 10;

export interface FiltrosListado {
  consulta?: string;
  precioMax?: number;
  personas?: "1" | "2" | "3";
}

export type ResultadoListado =
  | { exito: true; publicaciones: Publicacion[]; hayMas: boolean }
  | { exito: false; error: string };

/** Listado real: GET /api/publicaciones (Listado, vía Gateway), paginado con limite y offset. */
export async function listarPublicaciones(
  filtros: FiltrosListado = {},
  pagina = 1,
): Promise<ResultadoListado> {
  const partes = [`limite=${TAMANO_PAGINA}`, `offset=${(pagina - 1) * TAMANO_PAGINA}`];
  if (filtros.consulta?.trim()) partes.push(`consulta=${encodeURIComponent(filtros.consulta.trim())}`);
  if (filtros.precioMax !== undefined) partes.push(`precio_max=${filtros.precioMax}`);
  if (filtros.personas) partes.push(`personas=${filtros.personas}`);

  // El listado es público: no hace falta enviar el token de sesión.
  const resultado = await solicitarJson(`/api/publicaciones?${partes.join("&")}`, { autenticada: false });
  if (!resultado.exito) return { exito: false, error: resultado.error };
  if (!Array.isArray(resultado.datos)) {
    return { exito: false, error: "El servicio devolvió el listado en un formato inesperado." };
  }

  // Las imágenes pueden estar en otro servidor que el Gateway.
  // (Referencias estáticas: así Expo incluye los valores del entorno.)
  const urlBase =
    process.env.EXPO_PUBLIC_IMAGENES_URL?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim() || "";
  const publicaciones = resultado.datos
    .map((dato) => adaptarPublicacionListado(dato, urlBase))
    .filter((p): p is Publicacion => p !== null);

  // Si el servicio cambia de formato, es mejor avisar que mostrar una lista vacía.
  if (resultado.datos.length > 0 && publicaciones.length === 0) {
    return { exito: false, error: "El servicio devolvió publicaciones en un formato que la app no reconoce." };
  }

  // La API no entrega el total: si llegó una página completa, puede haber más.
  return { exito: true, publicaciones, hayMas: resultado.datos.length === TAMANO_PAGINA };
}