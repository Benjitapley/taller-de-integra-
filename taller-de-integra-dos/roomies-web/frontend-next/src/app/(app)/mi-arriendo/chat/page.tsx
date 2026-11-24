"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import DevelopmentReviewControl from "@/features/recorrido/DevelopmentReviewControl";
import { ChatView } from "@/features/recorrido/ConvivenciaViews";
import type { ConversacionDto, EstadoRecurso, MensajeVista } from "@/features/recorrido/types";

type ChatData = { conversation: ConversacionDto; messages: MensajeVista[] };
type ReviewState = "ready" | "empty" | "loading" | "error" | "forbidden";
const isDevelopment = process.env.NODE_ENV === "development";
const sample: ChatData = {
  conversation: { id_conversacion: 1, id_arriendo: 1, fecha_creacion: "2026-11-20T12:00:00.000Z" },
  messages: [
    { id_mensaje: 1, id_conversacion: 1, id_emisor: 2, nombre_emisor: "Alex (muestra)", contenido: "¡Hola! ¿Coordinamos las tareas de esta semana?", fecha: "2026-11-22T16:10:00.000Z" },
    { id_mensaje: 2, id_conversacion: 1, id_emisor: 3, nombre_emisor: "Sam (muestra)", contenido: "Sí, dejo una propuesta en Organización de la casa.", fecha: "2026-11-22T16:12:00.000Z" },
  ],
};
const unavailable: EstadoRecurso<ChatData> = { status: "error", message: "El chat de convivencia aún no está disponible. La API de mensajería no está conectada en este entorno." };

function stateForPreview(state: ReviewState): EstadoRecurso<ChatData> {
  if (state === "ready") return { status: "ready", data: sample };
  if (state === "empty") return { status: "ready", data: { ...sample, messages: [] } };
  if (state === "loading") return { status: "loading" };
  if (state === "forbidden") return { status: "forbidden" };
  return { status: "error", message: "No pudimos cargar el chat. Intenta nuevamente." };
}

export default function ChatPage() {
  const [preview, setPreview] = useState<ReviewState>("ready");
  const [state, setState] = useState<EstadoRecurso<ChatData>>(() => isDevelopment ? stateForPreview("ready") : unavailable);

  function changePreview(next: ReviewState) {
    setPreview(next);
    setState(stateForPreview(next));
  }

  function sendLocalMessage(content: string) {
    if (!isDevelopment || state.status !== "ready") return;
    const message: MensajeVista = {
      id_mensaje: Date.now(), id_conversacion: state.data.conversation.id_conversacion,
      id_emisor: 1, nombre_emisor: "Tú (muestra)", contenido: content,
      fecha: new Date().toISOString(), id_cliente: crypto.randomUUID(),
    };
    setState({ status: "ready", data: { ...state.data, messages: [...state.data.messages, message] } });
  }

  return <main>
    <PageHeader title="Chat del arriendo" description="Conversación compartida por integrantes activos." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    {isDevelopment ? <DevelopmentReviewControl label="Estado del chat" value={preview} onChange={changePreview} options={[
      { value: "ready", label: "Chat activo con mensajes de muestra" }, { value: "empty", label: "Chat sin mensajes" },
      { value: "loading", label: "Cargando" }, { value: "error", label: "Error recuperable" }, { value: "forbidden", label: "Acceso retirado (403)" },
    ]} /> : null}
    <ChatView state={state} currentUserId={isDevelopment ? 1 : undefined} onSend={isDevelopment && state.status === "ready" ? sendLocalMessage : undefined}
      onRetry={isDevelopment && state.status === "error" ? () => changePreview("ready") : undefined} />
  </main>;
}
