"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { ChatView, MembersView, TasksView } from "@/features/recorrido/ConvivenciaViews";
import type { ConversacionDto, EstadoRecurso, IntegranteArriendoDto, MensajeDto, TareaDto } from "@/features/recorrido/types";
import styles from "@/features/recorrido/recorrido.module.css";

const members: IntegranteArriendoDto[] = [
  { id_usuario: 11, nombre: "Alex Rivera", es_responsable: true, fecha_ingreso: "2026-11-17T12:00:00Z", activo: true },
  { id_usuario: 12, nombre: "Sam Torres", es_responsable: false, fecha_ingreso: "2026-11-18T12:00:00Z", activo: true },
];
const conversation: ConversacionDto = { id_conversacion: 31, id_arriendo: 7, fecha_creacion: "2026-11-18T12:00:00Z" };
const initialMessages: MensajeDto[] = [{ id_mensaje: 51, id_conversacion: 31, id_remitente: 12, nombre_remitente: "Sam Torres", contenido: "¿Coordinamos las compras de esta semana?", fecha_envio: "2026-11-20T15:30:00Z" }];
const initialTasks: TareaDto[] = [{ id_tarea: 81, id_arriendo: 7, titulo: "Aseo de espacios comunes", descripcion: "Cocina y living", estado: "Pendiente", id_creador: 11, id_asignado: null, fecha_creacion: "2026-11-20T10:00:00Z" }];

type PreviewState = "loading" | "error" | "forbidden" | "empty" | "ready";
function state<T>(status: PreviewState, data: T): EstadoRecurso<T> {
  if (status === "error") return { status, message: "No pudimos cargar la información. Intenta nuevamente." };
  if (status === "loading" || status === "forbidden" || status === "empty") return { status };
  return { status: "ready", data };
}

export default function RecorridoPreview() {
  const [selected, setSelected] = useState<PreviewState>("ready");
  const [messages, setMessages] = useState(initialMessages);
  const [tasks, setTasks] = useState(initialTasks);
  return <main className={styles.grid}>
    <Card className={styles.previewBanner}>
      <strong>Vista de revisión · datos ficticios de desarrollo</strong>
      <p>Estos ejemplos viven solo en memoria, no vienen del backend y se pierden al recargar.</p>
      <label htmlFor="preview-state">Estado de pantalla</label>
      <select id="preview-state" value={selected} onChange={(event) => setSelected(event.target.value as PreviewState)}>
        <option value="ready">Datos de ejemplo</option><option value="loading">Carga</option><option value="error">Error recuperable</option><option value="forbidden">Pertenencia retirada (403)</option><option value="empty">Sin datos</option>
      </select>
    </Card>
    <Card><h2>Postulantes (revisión separada)</h2><p>Esta sección se gestiona desde Mis publicaciones, no como integrante residente.</p></Card>
    <MembersView state={state(selected, members)} />
    <section><h2>Chat activo</h2><ChatView state={state(selected, { conversation, messages })} onSend={selected === "ready" ? (content) => setMessages((current) => [...current, { id_mensaje: Date.now(), id_conversacion: conversation.id_conversacion, id_remitente: 11, nombre_remitente: "Alex Rivera", contenido: content, fecha_envio: new Date().toISOString() }]) : undefined} /></section>
    <section><h2>Tareas</h2><TasksView state={state(selected, tasks)} members={members} onCreate={selected === "ready" ? (input) => setTasks((current) => [...current, { ...input, id_tarea: Date.now(), id_arriendo: 7, estado: "Pendiente", id_creador: 11, fecha_creacion: new Date().toISOString() }]) : undefined} /></section>
    <Card><h2>Retirada de acceso</h2><p>Al perder pertenencia, la API debe responder 403 y revocar chat y tareas. Selecciona “Pertenencia retirada” para revisar ese estado.</p></Card>
  </main>;
}
