import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { ChatView } from "@/features/recorrido/ConvivenciaViews";
import type { ConversacionDto, EstadoRecurso, MensajeDto } from "@/features/recorrido/types";

export default function ChatPage() {
  const state: EstadoRecurso<{ conversation: ConversacionDto; messages: MensajeDto[] }> = { status: "error", message: "El chat de convivencia aún no está disponible. La API de mensajería no está conectada en este entorno." };
  return <main><PageHeader title="Chat del arriendo" description="Conversación compartida por integrantes activos." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p><ChatView state={state} />
  </main>;
}
