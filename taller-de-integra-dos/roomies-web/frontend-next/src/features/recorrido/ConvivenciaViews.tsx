"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { TareaStatus } from "@/features/recorrido/JourneyStatus";
import type { ConversacionDto, EstadoRecurso, IntegranteArriendoDto, MensajeDto, TareaDto } from "@/features/recorrido/types";
import styles from "@/features/recorrido/recorrido.module.css";

function ResourceMessage<T>({ state, emptyTitle }: { state: EstadoRecurso<T>; emptyTitle: string }) {
  if (state.status === "loading") return <p role="status">Cargando información…</p>;
  if (state.status === "error") return <div><p role="alert">{state.message}</p><Button variant="secondary" onClick={() => window.location.reload()}>Reintentar</Button></div>;
  if (state.status === "forbidden") return <div role="status"><h2>Acceso retirado</h2><p>Ya no perteneces a este arriendo. El chat y las tareas solo están disponibles para integrantes activos.</p></div>;
  if (state.status === "empty") return <p>{emptyTitle}</p>;
  return null;
}

export function MembersView({ state, emptyTitle = "Todavía no hay integrantes registrados." }: { state: EstadoRecurso<IntegranteArriendoDto[]>; emptyTitle?: string }) {
  if (state.status !== "ready") return <Card><ResourceMessage state={state} emptyTitle={emptyTitle} /></Card>;
  const members = state.data.filter((member) => member.activo);
  const owner = members.filter((member) => member.es_responsable);
  const residents = members.filter((member) => !member.es_responsable);
  return <div className={styles.grid}>
    <section aria-labelledby="responsable-heading"><h2 id="responsable-heading">Arrendador responsable</h2><MemberList members={owner} empty="No hay un arrendador informado." /></section>
    <section aria-labelledby="members-heading"><h2 id="members-heading">Integrantes residentes</h2><MemberList members={residents} empty="Aún no hay otros integrantes residentes." /></section>
    <p className={styles.note}>Los postulantes se revisan por separado en <Link href="/mis-publicaciones">Mis publicaciones</Link>; no forman parte de la lista de integrantes.</p>
  </div>;
}

function MemberList({ members, empty }: { members: IntegranteArriendoDto[]; empty: string }) {
  return <Card>{members.length === 0 ? <p>{empty}</p> : <ul className={styles.list}>{members.map((member) => <li key={member.id_usuario}>
    <strong>{member.nombre || `Integrante #${member.id_usuario}`}</strong><span>{member.es_responsable ? "Arrendador responsable" : "Integrante residente"}</span>
  </li>)}</ul>}</Card>;
}

export function ChatView({ state, onSend }: {
  state: EstadoRecurso<{ conversation: ConversacionDto; messages: MensajeDto[] }>;
  onSend?: (content: string) => void;
}) {
  const [content, setContent] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = content.trim();
    if (!value || !onSend) return;
    onSend(value);
    setContent("");
  }
  if (state.status !== "ready") return <Card><ResourceMessage state={state} emptyTitle="Este arriendo todavía no tiene una conversación." /></Card>;
  return <Card className={styles.chatCard}>
    <div className={styles.messageList} role="log" aria-label="Mensajes de convivencia" aria-live="polite">
      {state.data.messages.length === 0 ? <p>Aún no hay mensajes. Puedes iniciar la conversación.</p> : state.data.messages.map((message) => <article className={styles.message} key={message.id_mensaje}>
        <strong>{message.nombre_remitente}</strong><p>{message.contenido}</p><time dateTime={message.fecha_envio}>{new Date(message.fecha_envio).toLocaleString("es-CL")}</time>
      </article>)}
    </div>
    <form className={styles.composer} onSubmit={submit}>
      <label htmlFor="chat-message">Escribe un mensaje</label>
      <textarea id="chat-message" value={content} onChange={(event) => setContent(event.target.value)} minLength={1} maxLength={2000} rows={3} disabled={!onSend} />
      <div className={styles.formFooter}><small>Máximo 2.000 caracteres</small><Button type="submit" disabled={!onSend || !content.trim()}>Enviar</Button></div>
      {!onSend ? <p className={styles.note}>El envío se habilitará cuando esté disponible la API de convivencia.</p> : null}
    </form>
  </Card>;
}

export function TasksView({ state, members, onCreate }: {
  state: EstadoRecurso<TareaDto[]>;
  members: IntegranteArriendoDto[];
  onCreate?: (input: { titulo: string; descripcion: string; id_asignado: number | null }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onCreate || !title.trim()) return;
    onCreate({ titulo: title.trim(), descripcion: description.trim(), id_asignado: assignee ? Number(assignee) : null });
    setTitle(""); setDescription(""); setAssignee("");
    setFormOpen(false);
  }
  return <div className={styles.grid}>
    <Card className={styles.taskBoard}>
      <div className={styles.sectionHeading}><h2>Organización de la casa</h2><Button variant="secondary" onClick={() => setFormOpen(true)}>＋ Nueva tarea</Button></div>
      {state.status !== "ready" ? <ResourceMessage state={state} emptyTitle="Todavía no hay tareas para este arriendo." /> : state.data.length === 0 ? <p>Todavía no hay tareas. Puedes proponer la primera.</p> : <ul className={styles.taskList}>{state.data.map((task) => <li key={task.id_tarea}>
        <div><strong>{task.titulo}</strong>{task.descripcion ? <p>{task.descripcion}</p> : null}<small>{task.id_asignado === null ? "Sin asignar" : `Asignada a ${members.find((member) => member.id_usuario === task.id_asignado)?.nombre ?? "integrante"}`}</small></div><TareaStatus estado={task.estado} />
      </li>)}</ul>}
    </Card>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nueva tarea">
      <form className={styles.taskForm} onSubmit={submit}>
      <p>Organiza responsabilidades del hogar. La asignación es opcional.</p>
      <label htmlFor="task-title">Nombre de la tarea</label><input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} disabled={!onCreate} />
      <label htmlFor="task-description">Descripción (opcional)</label><textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} disabled={!onCreate} />
      <label htmlFor="task-assignee">Asignar a (opcional)</label><select id="task-assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={!onCreate}>
        <option value="">Sin asignar</option>{members.filter((member) => member.activo).map((member) => <option key={member.id_usuario} value={member.id_usuario}>{member.nombre}</option>)}
      </select>
      <div className={styles.formFooter}><span aria-live="polite">{assignee ? `Asignada a ${members.find((member) => String(member.id_usuario) === assignee)?.nombre ?? "integrante"}` : "Se creará sin asignado"}</span><Button type="submit" disabled={!onCreate || !title.trim()}>Crear tarea</Button></div>
      {!onCreate ? <p className={styles.note}>El guardado se habilitará cuando esté disponible la API de convivencia.</p> : null}
      </form>
    </Modal>
  </div>;
}
