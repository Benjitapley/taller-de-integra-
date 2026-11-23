import { LARGO_TEXTO_MAXIMO, LARGO_TEXTO_MINIMO } from "@/types/api/ConversacionesDto";
import type { MensajeConvivencia } from "@/types/Convivencia";
import { leerFecha } from "@/utils/chatFechas";

// M4S3-D02 - reglas puras para ordenar y unir mensajes del chat, sin dependencias de
// React ni de la red, para poder probarlas con Node.

export function esConfirmado(mensaje: MensajeConvivencia): boolean {
  return mensaje.estado === undefined || mensaje.estado === "confirmado";
}

/** Dos mensajes son el mismo si comparten id de servidor o el UUID de cliente. */
export function mismoMensaje(a: MensajeConvivencia, b: MensajeConvivencia): boolean {
  if (a.idServidor && b.idServidor && a.idServidor === b.idServidor) return true;
  if (a.idCliente && b.idCliente && a.idCliente === b.idCliente) return true;
  return false;
}

function milisegundos(mensaje: MensajeConvivencia): number {
  return (mensaje.fechaIso ? leerFecha(mensaje.fechaIso)?.getTime() : undefined) ?? 0;
}

function compararCronologico(a: MensajeConvivencia, b: MensajeConvivencia): number {
  const diferencia = milisegundos(a) - milisegundos(b);
  if (diferencia !== 0) return diferencia;
  // Mismo instante: desempatar por id del servidor (numerico si se puede, texto si no).
  const idA = a.idServidor ?? "";
  const idB = b.idServidor ?? "";
  const numA = Number(idA);
  const numB = Number(idB);
  if (idA !== "" && idB !== "" && Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

/** Orden cronologico ascendente (el mas antiguo primero). No modifica el arreglo original. */
export function ordenarCronologico(mensajes: MensajeConvivencia[]): MensajeConvivencia[] {
  return [...mensajes].sort(compararCronologico);
}

/**
 * Confirmados en orden cronologico; despues los pendientes o con error, en el orden en que
 * se crearon. Asi un mensaje sin confirmar nunca queda "en medio" de la conversacion.
 */
export function ordenarConPendientes(mensajes: MensajeConvivencia[]): MensajeConvivencia[] {
  const confirmados = mensajes.filter(esConfirmado);
  const sinConfirmar = mensajes.filter((mensaje) => !esConfirmado(mensaje));
  return [...ordenarCronologico(confirmados), ...sinConfirmar];
}

/**
 * Une mensajes entrantes (de la API) con los que ya se muestran: sin duplicados.
 * Si un entrante coincide con uno existente (por id de servidor o por UUID de cliente) lo
 * reemplaza conservando la clave de lista, para que la fila no se vuelva a montar.
 */
export function fusionarMensajes(
  actuales: MensajeConvivencia[],
  entrantes: MensajeConvivencia[],
): MensajeConvivencia[] {
  const resultado = [...actuales];
  for (const nuevo of entrantes) {
    const indice = resultado.findIndex((existente) => mismoMensaje(existente, nuevo));
    if (indice === -1) resultado.push(nuevo);
    else resultado[indice] = { ...nuevo, id: resultado[indice].id };
  }
  return ordenarConPendientes(resultado);
}

/**
 * Texto valido para enviar: sin espacios en los extremos y de 1 a 2000 caracteres; si no, null.
 * La API tambien rechaza el caracter nulo (422), por eso se descarta aqui.
 */
export function normalizarTextoMensaje(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio.includes("\u0000")) return null;
  return limpio.length >= LARGO_TEXTO_MINIMO && limpio.length <= LARGO_TEXTO_MAXIMO ? limpio : null;
}
