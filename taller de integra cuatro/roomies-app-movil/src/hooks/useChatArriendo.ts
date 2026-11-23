import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { crearServiciosChat } from "@/services/conversacionesService";
import { crearControladorChat } from "@/stores/chatArriendo";


export function useChatArriendo(idConversacion: string | null = null) {
  const { usuarioActual } = useAuth();
  // Sin identidad se usa un valor que nunca coincide con una sesion: las peticiones fallan.
  const identidadId = usuarioActual?.identidad.id ?? "sin-sesion";

  const controlador = useMemo(
    () => crearControladorChat({
      servicios: crearServiciosChat(identidadId),
      idConversacionInicial: idConversacion,
    }),
    [identidadId, idConversacion],
  );
  const estado = useSyncExternalStore(controlador.suscribir, controlador.obtenerEstado, controlador.obtenerEstado);
  const [texto, setTexto] = useState("");

  useEffect(() => () => controlador.desactivar(), [controlador]);

  useFocusEffect(
    useCallback(() => {
      void controlador.alEnfocar();
    }, [controlador]),
  );

  const enviar = useCallback(() => {
    const resultado = controlador.enviar(texto);
    // El campo solo se limpia si el mensaje fue aceptado; si no, el texto no se pierde.
    if (resultado.aceptado) setTexto("");
    return resultado;
  }, [controlador, texto]);

  return {
    estado,
    texto,
    cambiarTexto: setTexto,
    enviar,
    reintentarEnvio: controlador.reintentar,
    descartarEnvio: controlador.descartar,
    actualizar: controlador.actualizar,
    cargarAnteriores: controlador.cargarAnteriores,
    reintentarCarga: controlador.iniciar,
  };
}
