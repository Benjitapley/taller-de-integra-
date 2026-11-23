import { solicitarJson } from "@/services/httpClient";
import { rutasPerfilPropio } from "@/services/provisionPerfilService";
import type { MensajeCrearDto } from "@/types/api/ConversacionesDto";
import {
  LARGO_TEXTO_MAXIMO,
  LARGO_TEXTO_MINIMO,
  LIMITE_MENSAJES_POR_PAGINA,
  LIMITE_PAGINA_MAXIMO,
  LIMITE_PAGINA_MINIMO,
} from "@/types/api/ConversacionesDto";
import type { MensajeConvivencia } from "@/types/Convivencia";
import type { ErrorHttp } from "@/types/Http";
import { horaLocal, leerFecha } from "@/utils/chatFechas";
import { normalizarTextoMensaje, ordenarCronologico } from "@/utils/chatMensajes";
import { esUuid } from "@/utils/uuid";

export interface ConversacionChat {
  id: string;
}

export interface PaginaMensajes {
  /** Orden cronologico ascendente (el mas antiguo primero), sin importar el orden de la API. */
  mensajes: MensajeConvivencia[];
  /** Valor de `antes` para pedir los mensajes anteriores; null si ya no hay mas historial. */
  siguienteCursor: string | null;
}

export type ResultadoServicio<T> = { exito: true; datos: T; estadoHttp: number } | ErrorHttp;

/** Lo que se usa de `solicitarJson`. Las pruebas pasan una version simulada. */
export type EnviarSolicitud = typeof solicitarJson;

export interface OpcionesListarMensajes {
  antes?: string | null;
  limite?: number;
  /**
   * id_usuario de quien consulta (GET del perfil propio). La API no marca los mensajes
   * propios: se comparan con este valor. Si el perfil no lo entrega (null), un mensaje es
   * propio cuando trae `id_cliente`, que el contrato 6.4 devuelve solo al emisor.
   */
  miIdUsuario: string | null;
}

export const RUTA_CONVERSACIONES = "/api/conversaciones";

const FORMATO_ID_TEXTO = /^[A-Za-z0-9_-]{1,64}$/;

export const rutaConversacion = (id: string): string =>
  `${RUTA_CONVERSACIONES}/${encodeURIComponent(id)}`;

export const rutaMensajes = (id: string): string => `${rutaConversacion(id)}/mensajes`;

function respuestaInvalida(estadoHttp: number): ErrorHttp {
  return {
    exito: false,
    codigo: "respuesta_invalida",
    error: "El servicio respondió algo que no pudimos interpretar.",
    estadoHttp,
  };
}

function peticionInvalida(error: string): ErrorHttp {
  return { exito: false, codigo: "peticion_invalida", error };
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Acepta un entero positivo o un texto simple y siempre lo entrega como texto. */
function leerId(valor: unknown): string | null {
  if (typeof valor === "number") return Number.isSafeInteger(valor) && valor >= 1 ? String(valor) : null;
  if (typeof valor === "string" && FORMATO_ID_TEXTO.test(valor)) return valor;
  return null;
}

// ---------------------------------------------------------------------------
// Adaptadores (DTO de la API -> modelo de la app)
// ---------------------------------------------------------------------------

export function leerConversacion(fila: unknown): ConversacionChat | null {
  if (!esObjeto(fila)) return null;
  const id = leerId(fila.id_conversacion);
  return id ? { id } : null;
}

/**
 * Convierte un mensaje de la API al modelo de la pantalla.
 * `idConversacion` es la conversacion que se pidio: un mensaje de otra no se mezcla.
 * `esPropio` se decide asi: en una lectura se compara id_emisor con `miIdUsuario`; si el perfil
 * no entrego id_usuario (`miIdUsuario: null`), es propio el mensaje que trae `id_cliente` (la API
 * lo devuelve solo al emisor); en la respuesta de un POST siempre es propio (`propio: true`).
 */
export function leerMensaje(
  fila: unknown,
  contexto: { idConversacion: string; miIdUsuario?: string | null; propio?: boolean },
): MensajeConvivencia | null {
  if (!esObjeto(fila)) return null;

  const idServidor = leerId(fila.id_mensaje);
  const idEmisor = leerId(fila.id_emisor);
  if (!idServidor || !idEmisor) return null;
  if (leerId(fila.id_conversacion) !== contexto.idConversacion) return null;
  if (typeof fila.contenido !== "string" || fila.contenido.length === 0) return null;
  if (typeof fila.fecha !== "string" || !leerFecha(fila.fecha)) return null;

  // id_cliente solo lo devuelve la API al emisor; si falta o no es un UUID se ignora.
  const idCliente = esUuid(fila.id_cliente) ? fila.id_cliente.toLowerCase() : null;

  let esPropio: boolean | null;
  if (contexto.propio !== undefined) esPropio = contexto.propio;
  else if (contexto.miIdUsuario) esPropio = idEmisor === contexto.miIdUsuario;
  else if (contexto.miIdUsuario === null) esPropio = idCliente !== null;
  else esPropio = null;
  if (esPropio === null) return null;

  return {
    id: `srv-${idServidor}`,
    idServidor,
    idCliente,
    idEmisor,
    // La API no entrega nombres ni fotos de otros integrantes (viven en Auth/Users).
    autorNombre: esPropio ? "Tú" : "Integrante",
    autorFotoUrl: null,
    texto: fila.contenido,
    fechaIso: fila.fecha,
    hora: horaLocal(fila.fecha),
    esPropio,
    estado: "confirmado",
  };
}

function leerPaginaMensajes(datos: unknown, idConversacion: string, miIdUsuario: string | null): PaginaMensajes | null {
  if (!esObjeto(datos) || !Array.isArray(datos.items)) return null;
  if (!("siguiente_cursor" in datos)) return null;

  const cursor = datos.siguiente_cursor;
  if (cursor !== null && (typeof cursor !== "string" || !cursor.trim())) return null;

  const mensajes: MensajeConvivencia[] = [];
  const idsVistos = new Set<string>();
  for (const fila of datos.items) {
    const mensaje = leerMensaje(fila, { idConversacion, miIdUsuario });
    if (!mensaje) return null;
    // Una pagina no debe repetir mensajes; si lo hace, se conserva el primero.
    if (mensaje.idServidor && idsVistos.has(mensaje.idServidor)) continue;
    if (mensaje.idServidor) idsVistos.add(mensaje.idServidor);
    mensajes.push(mensaje);
  }
  return { mensajes: ordenarCronologico(mensajes), siguienteCursor: cursor };
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

/** GET /api/conversaciones: la conversacion de convivencia de mi arriendo (items de la pagina). */
export async function listarConversaciones(
  enviar: EnviarSolicitud = solicitarJson,
): Promise<ResultadoServicio<ConversacionChat[]>> {
  const resultado = await enviar(RUTA_CONVERSACIONES);
  if (!resultado.exito) return resultado;

  const datos = resultado.datos;
  if (!esObjeto(datos) || !Array.isArray(datos.items)) return respuestaInvalida(resultado.estadoHttp);

  const conversaciones: ConversacionChat[] = [];
  for (const fila of datos.items) {
    const conversacion = leerConversacion(fila);
    if (!conversacion) return respuestaInvalida(resultado.estadoHttp);
    conversaciones.push(conversacion);
  }
  return { exito: true, datos: conversaciones, estadoHttp: resultado.estadoHttp };
}

/** GET /api/conversaciones/{id}: 403 si quien consulta no es participante activo. */
export async function obtenerConversacion(
  idConversacion: string,
  enviar: EnviarSolicitud = solicitarJson,
): Promise<ResultadoServicio<ConversacionChat>> {
  if (!leerId(idConversacion)) return peticionInvalida("No pudimos identificar la conversación.");

  const resultado = await enviar(rutaConversacion(idConversacion));
  if (!resultado.exito) return resultado;

  const conversacion = leerConversacion(resultado.datos);
  // La cabecera debe ser de la conversacion pedida.
  if (!conversacion || conversacion.id !== idConversacion) return respuestaInvalida(resultado.estadoHttp);
  return { exito: true, datos: conversacion, estadoHttp: resultado.estadoHttp };
}

/**
 * id_usuario de quien usa la app, tomado del perfil propio (GET /usuarios/me, que el contrato
 * v2 documenta con id_usuario). Se usa la misma ruta que el resto de la app para el perfil
 * (rutasPerfilPropio) y no se modifica el servicio de perfil, que es de otra tarea.
 * Si el perfil responde bien pero sin id_usuario (el servicio desplegado puede no incluirlo),
 * devuelve `null`: los mensajes propios se reconocen entonces por `id_cliente`.
 */
export async function obtenerMiIdUsuario(
  enviar: EnviarSolicitud = solicitarJson,
  rutaPerfil: string | null | undefined = rutasPerfilPropio()?.consulta,
): Promise<ResultadoServicio<string | null>> {
  if (!rutaPerfil) {
    return {
      exito: false,
      codigo: "configuracion",
      error: "La conexión con el perfil todavía no está configurada correctamente.",
    };
  }
  const resultado = await enviar(rutaPerfil);
  if (!resultado.exito) return resultado;

  if (!esObjeto(resultado.datos)) return respuestaInvalida(resultado.estadoHttp);
  const bruto = resultado.datos.id_usuario;
  // Perfil sin id_usuario: el servicio de perfil todavia no cumple el contrato v2; se sigue sin el.
  if (bruto === undefined || bruto === null) return { exito: true, datos: null, estadoHttp: resultado.estadoHttp };
  // Si viene pero esta mal formado es una respuesta invalida: no se ignora en silencio.
  const id = leerId(bruto);
  if (!id) return respuestaInvalida(resultado.estadoHttp);
  return { exito: true, datos: id, estadoHttp: resultado.estadoHttp };
}

/** GET /api/conversaciones/{id}/mensajes?antes=&limite= (historia hacia atras). */
export async function listarMensajes(
  idConversacion: string,
  opciones: OpcionesListarMensajes,
  enviar: EnviarSolicitud = solicitarJson,
): Promise<ResultadoServicio<PaginaMensajes>> {
  if (!leerId(idConversacion)) return peticionInvalida("No pudimos identificar la conversación.");
  if (opciones.miIdUsuario !== null && !leerId(opciones.miIdUsuario)) {
    return peticionInvalida("No pudimos identificar tu usuario.");
  }

  const limite = opciones.limite ?? LIMITE_MENSAJES_POR_PAGINA;
  if (!Number.isInteger(limite) || limite < LIMITE_PAGINA_MINIMO || limite > LIMITE_PAGINA_MAXIMO) {
    return peticionInvalida("El tamaño de página no es válido.");
  }
  const antes = opciones.antes ?? null;
  if (antes !== null && (typeof antes !== "string" || !antes.trim())) {
    return peticionInvalida("El cursor de la página no es válido.");
  }

  const consulta = `?limite=${limite}${antes === null ? "" : `&antes=${encodeURIComponent(antes)}`}`;
  const resultado = await enviar(`${rutaMensajes(idConversacion)}${consulta}`);
  if (!resultado.exito) return resultado;

  const pagina = leerPaginaMensajes(resultado.datos, idConversacion, opciones.miIdUsuario);
  if (!pagina) return respuestaInvalida(resultado.estadoHttp);
  return { exito: true, datos: pagina, estadoHttp: resultado.estadoHttp };
}

/**
 * POST /api/conversaciones/{id}/mensajes con { contenido, id_cliente } (sin Idempotency-Key).
 * `idCliente` debe ser el mismo en cada reintento del mismo mensaje: la API devuelve el mensaje
 * ya guardado, con el mismo id_mensaje, y no crea otro; el mismo id_cliente con otro contenido da 409.
 */
export async function enviarMensaje(
  idConversacion: string,
  datos: { idCliente: string; texto: string },
  enviar: EnviarSolicitud = solicitarJson,
): Promise<ResultadoServicio<MensajeConvivencia>> {
  if (!leerId(idConversacion)) return peticionInvalida("No pudimos identificar la conversación.");
  if (!esUuid(datos.idCliente)) return peticionInvalida("No pudimos preparar el mensaje para enviarlo.");
  const texto = normalizarTextoMensaje(datos.texto);
  if (texto === null) {
    return peticionInvalida(`El mensaje debe tener entre ${LARGO_TEXTO_MINIMO} y ${LARGO_TEXTO_MAXIMO} caracteres.`);
  }

  const cuerpo: MensajeCrearDto = { contenido: texto, id_cliente: datos.idCliente.toLowerCase() };
  const resultado = await enviar(rutaMensajes(idConversacion), { metodo: "POST", cuerpo });
  if (!resultado.exito) return resultado;

  // Crear devuelve 201 y un reintento ya procesado puede devolver 200: ambos son el mensaje guardado.
  const mensaje = resultado.estadoHttp === 200 || resultado.estadoHttp === 201
    ? leerMensaje(resultado.datos, { idConversacion, propio: true })
    : null;
  if (!mensaje) return respuestaInvalida(resultado.estadoHttp);
  // Si la API no devuelve el eco de id_cliente, se conserva el que se envio.
  return {
    exito: true,
    datos: { ...mensaje, idCliente: mensaje.idCliente ?? cuerpo.id_cliente },
    estadoHttp: resultado.estadoHttp,
  };
}

/**
 * Servicios del chat atados a una identidad: cada peticion lleva `identidadEsperada`, de modo
 * que si la cuenta cambia mientras una respuesta esta en vuelo no se envia el token de otra
 * cuenta (mismo mecanismo que el perfil propio, ver httpClient.ts).
 */
export function crearServiciosChat(identidadEsperada: string, solicitar: EnviarSolicitud = solicitarJson) {
  const enviar: EnviarSolicitud = (ruta, opciones) => solicitar(ruta, { ...opciones, identidadEsperada });
  return {
    listarConversaciones: () => listarConversaciones(enviar),
    obtenerConversacion: (idConversacion: string) => obtenerConversacion(idConversacion, enviar),
    obtenerMiIdUsuario: () => obtenerMiIdUsuario(enviar),
    listarMensajes: (idConversacion: string, opciones: OpcionesListarMensajes) =>
      listarMensajes(idConversacion, opciones, enviar),
    enviarMensaje: (idConversacion: string, datos: { idCliente: string; texto: string }) =>
      enviarMensaje(idConversacion, datos, enviar),
  };
}
