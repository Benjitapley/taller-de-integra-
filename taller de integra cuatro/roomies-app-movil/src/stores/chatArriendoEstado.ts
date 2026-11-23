import type { ConversacionChat, PaginaMensajes } from "@/services/conversacionesService";
import type { MensajeConvivencia } from "@/types/Convivencia";
import type { ErrorHttp } from "@/types/Http";
import { esConfirmado, fusionarMensajes, mismoMensaje, ordenarConPendientes } from "@/utils/chatMensajes";

// M4S3-D02 - estado del chat del arriendo. Es un reducer puro: no usa React, red ni
// tiempo, asi que se prueba con Node. Las decisiones de "cuando pedir que" estan en
// chatArriendo.ts; aqui solo se decide "como queda el estado" despues de cada hecho.

export type FaseChat =
  | "resolviendo" // buscando la conversacion del arriendo
  | "sin_conversacion" // la API no devolvio una conversacion de arriendo
  | "cargando" // conversacion conocida, falta la primera pagina
  | "listo"
  | "error" // fallo la carga inicial (se puede reintentar)
  | "sin_acceso"; // la API nego o no encontro la conversacion: se limpia la vista

export interface EstadoChat {
  fase: FaseChat;
  conversacion: ConversacionChat | null;
  /** Orden cronologico; al final los mensajes propios pendientes o con error. */
  mensajes: MensajeConvivencia[];
  /** Valor de `antes` para el historial anterior; null cuando no hay mas. */
  cursorAnterior: string | null;
  cargandoAnteriores: boolean;
  errorAnteriores: ErrorHttp | null;
  actualizando: boolean;
  errorActualizacion: ErrorHttp | null;
  /** Error de la carga inicial (solo con fase "error"). */
  error: ErrorHttp | null;
}

export const ESTADO_CHAT_INICIAL: EstadoChat = {
  fase: "resolviendo",
  conversacion: null,
  mensajes: [],
  cursorAnterior: null,
  cargandoAnteriores: false,
  errorAnteriores: null,
  actualizando: false,
  errorActualizacion: null,
  error: null,
};

export type AccionChat =
  | { tipo: "resolviendo" }
  | { tipo: "sin_conversacion" }
  | { tipo: "conversacion"; conversacion: ConversacionChat }
  | { tipo: "pagina_inicial"; pagina: PaginaMensajes }
  | { tipo: "error_carga"; error: ErrorHttp }
  | { tipo: "actualizando" }
  | { tipo: "actualizado"; pagina: PaginaMensajes }
  | { tipo: "error_actualizacion"; error: ErrorHttp }
  | { tipo: "cargando_anteriores" }
  | { tipo: "anteriores"; pagina: PaginaMensajes }
  | { tipo: "error_anteriores"; error: ErrorHttp }
  | { tipo: "envio_local"; mensaje: MensajeConvivencia }
  | { tipo: "envio_ok"; clave: string; mensaje: MensajeConvivencia }
  | { tipo: "envio_error"; clave: string }
  | { tipo: "reintento"; clave: string }
  | { tipo: "descartar"; clave: string }
  | { tipo: "sin_acceso" };

function reemplazarMensaje(
  mensajes: MensajeConvivencia[],
  clave: string,
  cambiar: (mensaje: MensajeConvivencia) => MensajeConvivencia | null,
): MensajeConvivencia[] {
  const resultado: MensajeConvivencia[] = [];
  for (const mensaje of mensajes) {
    if (mensaje.id !== clave) {
      resultado.push(mensaje);
      continue;
    }
    const cambiado = cambiar(mensaje);
    if (cambiado) resultado.push(cambiado);
  }
  return resultado;
}

export function reducirChat(estado: EstadoChat, accion: AccionChat): EstadoChat {
  switch (accion.tipo) {
    case "resolviendo":
      return ESTADO_CHAT_INICIAL;

    case "sin_conversacion":
      return { ...ESTADO_CHAT_INICIAL, fase: "sin_conversacion" };

    case "conversacion":
      return { ...ESTADO_CHAT_INICIAL, fase: "cargando", conversacion: accion.conversacion };

    case "pagina_inicial":
      return {
        ...estado,
        fase: "listo",
        mensajes: fusionarMensajes(estado.mensajes.filter((m) => !esConfirmado(m)), accion.pagina.mensajes),
        cursorAnterior: accion.pagina.siguienteCursor,
        cargandoAnteriores: false,
        errorAnteriores: null,
        actualizando: false,
        errorActualizacion: null,
        error: null,
      };

    case "error_carga":
      return { ...estado, fase: "error", error: accion.error, actualizando: false, cargandoAnteriores: false };

    case "actualizando":
      return { ...estado, actualizando: true, errorActualizacion: null };

    case "actualizado": {
      const confirmados = estado.mensajes.filter(esConfirmado);
      const sinConfirmar = estado.mensajes.filter((m) => !esConfirmado(m));
      const pagina = accion.pagina;
      // La pagina mas reciente "se une" al historial cargado si comparte algun mensaje con el
      // o si llega hasta el inicio de la conversacion. Si no, entre ambos pudo haber mensajes
      // que no tenemos: se reemplaza el historial por la pagina nueva (se puede volver a
      // paginar hacia atras) en vez de mostrar una conversacion con huecos.
      const seUne = confirmados.length === 0
        || pagina.siguienteCursor === null
        || pagina.mensajes.some((nuevo) => confirmados.some((actual) => mismoMensaje(actual, nuevo)));

      if (seUne) {
        // Si la pagina llega al inicio, no hay nada mas antiguo; si no, se conserva el cursor
        // del historial ya cargado (mas profundo que el de la pagina reciente).
        const cursorAnterior = confirmados.length === 0 || pagina.siguienteCursor === null
          ? pagina.siguienteCursor
          : estado.cursorAnterior;
        const cursorCambio = cursorAnterior !== estado.cursorAnterior;
        return {
          ...estado,
          fase: "listo",
          mensajes: fusionarMensajes(estado.mensajes, pagina.mensajes),
          cursorAnterior,
          // Una carga de anteriores en curso con el cursor viejo se descarta al responder.
          cargandoAnteriores: cursorCambio ? false : estado.cargandoAnteriores,
          errorAnteriores: cursorCambio ? null : estado.errorAnteriores,
          actualizando: false,
          errorActualizacion: null,
        };
      }
      return {
        ...estado,
        fase: "listo",
        mensajes: fusionarMensajes(sinConfirmar, pagina.mensajes),
        cursorAnterior: pagina.siguienteCursor,
        cargandoAnteriores: false,
        errorAnteriores: null,
        actualizando: false,
        errorActualizacion: null,
      };
    }

    case "error_actualizacion":
      return { ...estado, actualizando: false, errorActualizacion: accion.error };

    case "cargando_anteriores":
      return { ...estado, cargandoAnteriores: true, errorAnteriores: null };

    case "anteriores":
      return {
        ...estado,
        mensajes: fusionarMensajes(estado.mensajes, accion.pagina.mensajes),
        cursorAnterior: accion.pagina.siguienteCursor,
        cargandoAnteriores: false,
        errorAnteriores: null,
      };

    case "error_anteriores":
      return { ...estado, cargandoAnteriores: false, errorAnteriores: accion.error };

    case "envio_local":
      return { ...estado, mensajes: ordenarConPendientes([...estado.mensajes, accion.mensaje]) };

    case "envio_ok": {
      const existe = estado.mensajes.some((m) => m.id === accion.clave);
      // Si el usuario descarto el mensaje mientras viajaba, no se vuelve a mostrar: aparecera
      // en la siguiente actualizacion porque la API si lo guardo.
      if (!existe) return estado;
      const confirmado: MensajeConvivencia = { ...accion.mensaje, id: accion.clave, estado: "confirmado" };
      // Si una actualizacion ya trajo este mismo mensaje sin poder conciliarlo, se quita la copia.
      const mensajes = reemplazarMensaje(estado.mensajes, accion.clave, () => confirmado)
        .filter((m) => m.id === accion.clave || !mismoMensaje(m, confirmado));
      return { ...estado, mensajes: ordenarConPendientes(mensajes) };
    }

    case "envio_error":
      return {
        ...estado,
        mensajes: reemplazarMensaje(estado.mensajes, accion.clave, (m) =>
          m.estado === "pendiente" ? { ...m, estado: "error" } : m),
      };

    case "reintento":
      return {
        ...estado,
        mensajes: reemplazarMensaje(estado.mensajes, accion.clave, (m) =>
          m.estado === "error" ? { ...m, estado: "pendiente" } : m),
      };

    case "descartar":
      return {
        ...estado,
        mensajes: reemplazarMensaje(estado.mensajes, accion.clave, (m) => (esConfirmado(m) ? m : null)),
      };

    case "sin_acceso":
      // Se borra todo lo privado: mensajes, conversacion y cursores.
      return { ...ESTADO_CHAT_INICIAL, fase: "sin_acceso" };
  }
}
