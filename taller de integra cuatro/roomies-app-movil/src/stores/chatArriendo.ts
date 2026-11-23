import type { ConversacionChat, PaginaMensajes, ResultadoServicio } from "@/services/conversacionesService";
import { ESTADO_CHAT_INICIAL, reducirChat, type AccionChat, type EstadoChat } from "@/stores/chatArriendoEstado";
import { LIMITE_MENSAJES_POR_PAGINA } from "@/types/api/ConversacionesDto";
import type { MensajeConvivencia } from "@/types/Convivencia";
import type { ErrorHttp } from "@/types/Http";
import { horaLocal } from "@/utils/chatFechas";
import { normalizarTextoMensaje } from "@/utils/chatMensajes";
import { generarUuidV4 } from "@/utils/uuid";

// M4S3-D02 - controlador del chat del arriendo.
//
// Decide CUANDO pedir cada cosa a la API y descarta las respuestas que llegan tarde
// (otra cuenta, pantalla cerrada, historial reemplazado). El estado vive aqui, en un
// almacen pequeno que React lee con useSyncExternalStore (mismo patron que
// crearAlmacenConvivenciaDemo). No importa React ni la red: los servicios se inyectan,
// asi que se prueba con Node (tests/chatArriendo.test.mjs).
//
// Secuencia de la carga inicial: conversacion del arriendo -> mi id_usuario (perfil propio)
// -> primera pagina de mensajes.

export interface ServiciosChat {
  listarConversaciones: () => Promise<ResultadoServicio<ConversacionChat[]>>;
  obtenerConversacion: (idConversacion: string) => Promise<ResultadoServicio<ConversacionChat>>;
  obtenerMiIdUsuario: () => Promise<ResultadoServicio<string | null>>;
  listarMensajes: (
    idConversacion: string,
    opciones: { antes?: string | null; limite?: number; miIdUsuario: string | null },
  ) => Promise<ResultadoServicio<PaginaMensajes>>;
  enviarMensaje: (
    idConversacion: string,
    datos: { idCliente: string; texto: string },
  ) => Promise<ResultadoServicio<MensajeConvivencia>>;
}

export interface OpcionesControladorChat {
  servicios: ServiciosChat;
  /** Si se conoce el id (p. ej. lo entrega Mi arriendo), se salta la busqueda en la lista. */
  idConversacionInicial?: string | null;
  generarId?: () => string;
  ahoraIso?: () => string;
  limite?: number;
}

export type ResultadoEnvio =
  | { aceptado: true }
  | { aceptado: false; motivo: "texto_invalido" | "chat_no_disponible" };

/**
 * Solo existe el tipo de conversacion "Convivencia" y un integrante activo tiene una sola
 * (la de su arriendo): se usa la primera de la lista.
 */
export function elegirConversacionArriendo(conversaciones: ConversacionChat[]): ConversacionChat | null {
  return conversaciones[0] ?? null;
}

export function crearControladorChat(opciones: OpcionesControladorChat) {
  const { servicios } = opciones;
  const generarId = opciones.generarId ?? generarUuidV4;
  const ahoraIso = opciones.ahoraIso ?? (() => new Date().toISOString());
  const limite = opciones.limite ?? LIMITE_MENSAJES_POR_PAGINA;
  const idConversacionInicial = opciones.idConversacionInicial ?? null;

  let estado: EstadoChat = ESTADO_CHAT_INICIAL;
  // id_usuario de quien usa la app: la API no marca los mensajes propios, se comparan con este.
  // null con usuarioResuelto = el perfil no trae id_usuario: los mensajes propios se reconocen por id_cliente.
  let miIdUsuario: string | null = null;
  let usuarioResuelto = false;
  // Cambia al desactivar: toda respuesta de una generacion anterior se descarta.
  let generacion = 0;
  let iniciando = false;
  const oyentes = new Set<() => void>();

  function suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  }

  function obtenerEstado(): EstadoChat {
    return estado;
  }

  function despachar(accion: AccionChat) {
    estado = reducirChat(estado, accion);
    oyentes.forEach((oyente) => oyente());
  }

  /** Sin acceso: se borra todo lo privado, tambien el id de usuario resuelto. */
  function perderAcceso() {
    miIdUsuario = null;
    usuarioResuelto = false;
    despachar({ tipo: "sin_acceso" });
  }

  // Contrato v2: quien no es integrante activo (por ejemplo, fue retirado) recibe 403 sin_permiso,
  // historial incluido; 404 es "no existe". Mientras el chat funcionaba, un 404 tampoco puede
  // significar "no existe" (la conversacion estaba abierta): se trata como acceso perdido, igual
  // que 403/404 en el retiro de la web (E05). En la primera carga un 404 es un error normal
  // (conversacion inexistente o ruta aun no desplegada) y se puede reintentar.
  function perdioAcceso(error: ErrorHttp): boolean {
    if (error.codigo === "sin_permiso") return true;
    return error.estadoHttp === 404 && estado.fase === "listo";
  }

  type Resolucion =
    | { tipo: "ok"; conversacion: ConversacionChat }
    | { tipo: "vacio" }
    | { tipo: "fallo"; error: ErrorHttp };

  async function resolverConversacion(): Promise<Resolucion> {
    if (idConversacionInicial) {
      // Con id conocido se confirma el acceso con la cabecera (403 si no es participante activo).
      const detalle = await servicios.obtenerConversacion(idConversacionInicial);
      return detalle.exito ? { tipo: "ok", conversacion: detalle.datos } : { tipo: "fallo", error: detalle };
    }
    const lista = await servicios.listarConversaciones();
    if (!lista.exito) return { tipo: "fallo", error: lista };
    const elegida = elegirConversacionArriendo(lista.datos);
    return elegida ? { tipo: "ok", conversacion: elegida } : { tipo: "vacio" };
  }

  /** Busca la conversacion y mi usuario (si hace falta) y carga la primera pagina. Tambien sirve para reintentar. */
  async function iniciar(): Promise<void> {
    if (iniciando) return;
    iniciando = true;
    const gen = generacion;
    try {
      let conversacion = (estado.fase === "cargando" || estado.fase === "error") ? estado.conversacion : null;

      if (!conversacion) {
        despachar({ tipo: "resolviendo" });
        const resolucion = await resolverConversacion();
        if (gen !== generacion) return;
        if (resolucion.tipo === "vacio") {
          despachar({ tipo: "sin_conversacion" });
          return;
        }
        if (resolucion.tipo === "fallo") {
          if (perdioAcceso(resolucion.error)) perderAcceso();
          else despachar({ tipo: "error_carga", error: resolucion.error });
          return;
        }
        conversacion = resolucion.conversacion;
      }

      despachar({ tipo: "conversacion", conversacion });

      if (!usuarioResuelto) {
        const usuario = await servicios.obtenerMiIdUsuario();
        if (gen !== generacion) return;
        if (!usuario.exito) {
          // Un fallo del perfil no dice nada sobre el acceso al chat: se puede reintentar.
          despachar({ tipo: "error_carga", error: usuario });
          return;
        }
        miIdUsuario = usuario.datos;
        usuarioResuelto = true;
      }

      const resultado = await servicios.listarMensajes(conversacion.id, { limite, miIdUsuario });
      if (gen !== generacion) return;
      if (resultado.exito) {
        despachar({ tipo: "pagina_inicial", pagina: resultado.datos });
      } else if (perdioAcceso(resultado)) {
        perderAcceso();
      } else {
        despachar({ tipo: "error_carga", error: resultado });
      }
    } finally {
      // Solo la generacion vigente libera el candado (desactivar ya lo libero).
      if (gen === generacion) iniciando = false;
    }
  }

  /** Vuelve a pedir la pagina mas reciente y la une al historial; no recarga todo. */
  async function actualizar(): Promise<void> {
    const conversacion = estado.conversacion;
    const usuario = miIdUsuario;
    if (estado.fase !== "listo" || !conversacion || !usuarioResuelto || estado.actualizando) return;
    const gen = generacion;

    despachar({ tipo: "actualizando" });
    const resultado = await servicios.listarMensajes(conversacion.id, { limite, miIdUsuario: usuario });
    if (gen !== generacion) return;

    if (resultado.exito) despachar({ tipo: "actualizado", pagina: resultado.datos });
    else if (perdioAcceso(resultado)) perderAcceso();
    else despachar({ tipo: "error_actualizacion", error: resultado });
  }

  /** Pide la pagina anterior (`antes` = cursor actual). Sin cursor no hay mas historial. */
  async function cargarAnteriores(): Promise<void> {
    const conversacion = estado.conversacion;
    const usuario = miIdUsuario;
    const cursor = estado.cursorAnterior;
    if (estado.fase !== "listo" || !conversacion || !usuarioResuelto || estado.cargandoAnteriores || cursor === null) return;
    const gen = generacion;

    despachar({ tipo: "cargando_anteriores" });
    const resultado = await servicios.listarMensajes(conversacion.id, { antes: cursor, limite, miIdUsuario: usuario });
    if (gen !== generacion) return;
    // Si mientras tanto una actualizacion reemplazo el historial, esta pagina ya no encaja.
    if (estado.fase !== "listo" || estado.cursorAnterior !== cursor) return;

    if (resultado.exito) despachar({ tipo: "anteriores", pagina: resultado.datos });
    else if (perdioAcceso(resultado)) perderAcceso();
    else despachar({ tipo: "error_anteriores", error: resultado });
  }

  async function transmitir(mensaje: MensajeConvivencia): Promise<void> {
    const conversacion = estado.conversacion;
    if (!conversacion || !mensaje.idCliente) return;
    const gen = generacion;

    const resultado = await servicios.enviarMensaje(conversacion.id, {
      idCliente: mensaje.idCliente,
      texto: mensaje.texto,
    });
    if (gen !== generacion) return;

    if (resultado.exito) despachar({ tipo: "envio_ok", clave: mensaje.id, mensaje: resultado.datos });
    else if (perdioAcceso(resultado)) perderAcceso();
    else despachar({ tipo: "envio_error", clave: mensaje.id });
  }

  /** Muestra el mensaje como pendiente y lo envia. El texto se valida antes (1-2000). */
  function enviar(texto: string): ResultadoEnvio {
    const limpio = normalizarTextoMensaje(texto);
    if (limpio === null) return { aceptado: false, motivo: "texto_invalido" };
    if (estado.fase !== "listo" || !estado.conversacion) return { aceptado: false, motivo: "chat_no_disponible" };

    // El mismo idCliente se usa en todos los reintentos de este mensaje.
    const idCliente = generarId();
    const fechaIso = ahoraIso();
    const mensaje: MensajeConvivencia = {
      id: idCliente,
      idServidor: null,
      idCliente,
      idEmisor: miIdUsuario,
      autorNombre: "Tú",
      autorFotoUrl: null,
      texto: limpio,
      fechaIso,
      hora: horaLocal(fechaIso),
      esPropio: true,
      estado: "pendiente",
    };
    despachar({ tipo: "envio_local", mensaje });
    void transmitir(mensaje);
    return { aceptado: true };
  }

  /** Reintento manual de un mensaje con error: mismo idCliente, nunca automatico. */
  function reintentar(clave: string): void {
    const mensaje = estado.mensajes.find((m) => m.id === clave);
    if (!mensaje || mensaje.estado !== "error") return;
    despachar({ tipo: "reintento", clave });
    void transmitir({ ...mensaje, estado: "pendiente" });
  }

  function descartar(clave: string): void {
    despachar({ tipo: "descartar", clave });
  }

  /** Al enfocar la pantalla: primera carga, o actualizacion si el chat ya estaba listo. */
  async function alEnfocar(): Promise<void> {
    if (estado.fase === "listo") await actualizar();
    else await iniciar();
  }

  /** Al salir de la pantalla o cambiar de cuenta: las respuestas en vuelo se descartan. */
  function desactivar(): void {
    generacion += 1;
    iniciando = false;
  }

  return {
    suscribir,
    obtenerEstado,
    alEnfocar,
    iniciar,
    actualizar,
    cargarAnteriores,
    enviar,
    reintentar,
    descartar,
    desactivar,
  };
}

export type ControladorChat = ReturnType<typeof crearControladorChat>;
