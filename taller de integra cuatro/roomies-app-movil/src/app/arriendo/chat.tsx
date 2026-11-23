import { useState } from "react";
import ContenedorChat from "@/components/chat/ContenedorChat";
import EncabezadoConvivencia from "@/components/EncabezadoConvivencia";
import { INTEGRANTES_MOCK, MENSAJES_MOCK, USUARIO_ACTUAL_MOCK } from "@/data/convivenciaMock";
import type { MensajeConvivencia } from "@/types/Convivencia";


function horaActualTexto(): string {
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

export default function ChatArriendo() {
  const [mensajes, setMensajes] = useState<MensajeConvivencia[]>(MENSAJES_MOCK);
  const [texto, setTexto] = useState("");

  function enviarMensaje() {
    const contenido = texto.trim();
    if (contenido === "") return;

    setMensajes((actuales) => [
      ...actuales,
      {
        id: `local-${Date.now()}`,
        autorNombre: USUARIO_ACTUAL_MOCK.nombre,
        autorFotoUrl: USUARIO_ACTUAL_MOCK.fotoUrl,
        texto: contenido,
        hora: horaActualTexto(),
        esPropio: true,
      },
    ]);
    setTexto("");
  }

  return (
    <ContenedorChat
      encabezado={<EncabezadoConvivencia integrantes={INTEGRANTES_MOCK} />}
      mensajes={mensajes}
      texto={texto}
      onCambiarTexto={setTexto}
      onEnviar={enviarMensaje}
    />
  );
}
