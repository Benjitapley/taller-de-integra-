"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { TareaStatus } from "@/features/recorrido/JourneyStatus";
import type { ConversacionDto, EstadoRecurso, IntegranteArriendoDto, MensajeVista, TareaDto } from "@/features/recorrido/types";
import styles from "@/features/recorrido/recorrido.module.css";

function ResourceMessage<T>({ state, emptyTitle, onRetry }: { state: EstadoRecurso<T>; emptyTitle: string; onRetry?: () => void }) {
  if (state.status === "loading") return <p role="status">Cargando información…</p>;
  if (state.status === "error") return <div><p role="alert">{state.message}</p>{onRetry ? <Button variant="secondary" onClick={onRetry}>Reintentar</Button> : null}</div>;
  if (state.status === "forbidden") return <div role="status"><h2>Acceso retirado</h2><p>Ya no perteneces a este arriendo. El chat y las tareas solo están disponibles para integrantes activos.</p></div>;
  if (state.status === "empty") return <p>{emptyTitle}</p>;
  return null;
}

export function MembersView({ state, onRetry, emptyTitle = "Todavía no hay integrantes registrados." }: { state: EstadoRecurso<IntegranteArriendoDto[]>; onRetry?: () => void; emptyTitle?: string }) {
  if (state.status !== "ready") return <Card><ResourceMessage state={state} emptyTitle={emptyTitle} onRetry={onRetry} /></Card>;
  const members = state.data.filter((member) => member.activo);
  const responsible = members.filter((member) => member.es_responsable);
  const residents = members.filter((member) => !member.es_responsable);
  return <div className={styles.grid}>
    <section aria-labelledby="responsable-heading"><h2 id="responsable-heading">Responsable de convivencia</h2><MemberList members={responsible} empty="No hay responsable asignado." /></section>
    <section aria-labelledby="members-heading"><h2 id="members-heading">Otros integrantes residentes</h2><MemberList members={residents} empty="Aún no hay otros integrantes residentes." /></section>
    <p className={styles.note}>El arrendador dueño y los postulantes se consultan por separado en <Link href="/mis-publicaciones">Mis publicaciones</Link>; no forman parte de esta lista de residentes.</p>
  </div>;
}

function MemberList({ members, empty }: { members: IntegranteArriendoDto[]; empty: string }) {
  return <Card>{members.length === 0 ? <p>{empty}</p> : <ul className={styles.list}>{members.map((member) => <li key={member.id_usuario}>
    <span className={styles.memberIdentity}><span className={styles.avatar} aria-hidden="true">{member.nombre?.charAt(0) || "?"}</span><strong>{member.nombre || `Integrante #${member.id_usuario}`}</strong></span><span className={styles.memberRole}>{member.es_responsable ? "Responsable" : "Integrante"}</span>
  </li>)}</ul>}</Card>;
}

export function ChatView({ state, onSend, onRetry, currentUserId }: {
  state: EstadoRecurso<{ conversation: ConversacionDto; messages: MensajeVista[] }>;
  onSend?: (content: string) => void;
  onRetry?: () => void;
  currentUserId?: number;
}) {
  const [content, setContent] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = content.trim();
    if (!value || !onSend) return;
    onSend(value);
    setContent("");
  }
  if (state.status !== "ready") return <Card><ResourceMessage state={state} emptyTitle="Este arriendo todavía no tiene una conversación." onRetry={onRetry} /></Card>;
  return <Card className={styles.chatCard}>
    <div className={styles.chatHeading}><span className={styles.iconBubble}><Icon name="chat" size={22} /></span><div><h2>Chat del arriendo</h2><p>Conversación de convivencia · Arriendo #{state.data.conversation.id_arriendo}</p></div></div>
    <div className={styles.messageList} role="log" aria-label="Mensajes de convivencia" aria-live="polite">
      {state.data.messages.length === 0 ? <p>Aún no hay mensajes. Puedes iniciar la conversación.</p> : state.data.messages.map((message) => <article className={`${styles.message} ${message.id_emisor === currentUserId ? styles.myMessage : ""}`} key={message.id_mensaje}>
        <strong>{message.nombre_emisor}</strong><p>{message.contenido}</p><time dateTime={message.fecha}>{new Date(message.fecha).toLocaleString("es-CL")}</time>
      </article>)}
    </div>
    <form className={styles.composer} onSubmit={submit}>
      <label htmlFor="chat-message">Escribe un mensaje</label>
      <textarea id="chat-message" placeholder="Escribe un mensaje…" value={content} onChange={(event) => setContent(event.target.value)} minLength={1} maxLength={2000} rows={2} disabled={!onSend} />
      <div className={styles.formFooter}><small>Máximo 2.000 caracteres</small><Button type="submit" disabled={!onSend || !content.trim()}>Enviar</Button></div>
      {!onSend ? <p className={styles.note}>El envío se habilitará cuando esté disponible la API de convivencia.</p> : null}
    </form>
  </Card>;
}

export function TasksView({ state, members, onCreate, onRetry, onAssign, onComplete, busy = false }: {
  state: EstadoRecurso<TareaDto[]>;
  onAssign?: (id: number, assignee: number | null) => void;
  onComplete?: (id: number) => void;
  busy?: boolean;
  members: IntegranteArriendoDto[];
  onCreate?: (input: { titulo: string; descripcion: string; id_asignado: number | null }) => void;
  onRetry?: () => void;
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
  if (state.status !== "ready") return <Card><ResourceMessage state={state} emptyTitle="Todavía no hay tareas para este arriendo." onRetry={onRetry} /></Card>;
  return <div className={styles.grid}>
    <Card className={styles.taskBoard}>
      <div className={styles.sectionHeading}><h2>Organización de la casa</h2><Button variant="secondary" onClick={() => setFormOpen(true)}>＋ Nueva tarea</Button></div>
      {state.data.length === 0 ? <p>Todavía no hay tareas. Puedes proponer la primera.</p> : <ul className={styles.taskList}>{state.data.map((task) => <li key={task.id_tarea}>
        <div><strong>{task.titulo}</strong>{task.descripcion ? <p>{task.descripcion}</p> : null}<small>{task.id_asignado === null ? "Sin asignar" : `Asignada a ${members.find((member) => member.id_usuario === task.id_asignado)?.nombre ?? "integrante"}`}</small></div><TareaStatus estado={task.estado} />
        {task.estado === "Pendiente" && onAssign ? <label>Asignar tarea
          <select aria-label={`Asignar ${task.titulo}`} value={task.id_asignado ?? ""} disabled={busy} onChange={event => onAssign(task.id_tarea, event.target.value ? Number(event.target.value) : null)}>
            <option value="">Sin asignar</option>{members.map(member => <option key={member.id_usuario} value={member.id_usuario}>{member.nombre || `Integrante #${member.id_usuario}`}</option>)}
          </select>
        </label> : null}
        {task.estado === "Pendiente" && task.id_asignado !== null && onComplete ? <Button disabled={busy} onClick={() => onComplete(task.id_tarea)}>Completar</Button> : null}
      </li>)}</ul>}
    </Card>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nueva tarea" surfaceClassName={styles.taskModalSurface}>
      <form className={styles.taskForm} onSubmit={submit}>
      <p className={styles.formIntro}>Organiza responsabilidades del hogar. La asignación es opcional.</p>
      <label htmlFor="task-title">Nombre de la tarea</label><input id="task-title" placeholder="Ej.: Aseo de la cocina" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} disabled={!onCreate} />
      <label htmlFor="task-description">Descripción (opcional)</label><textarea id="task-description" placeholder="Detalles de la tarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={2} disabled={!onCreate} />
      <label htmlFor="task-assignee">Asignar a (opcional)</label><select id="task-assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={!onCreate}>
        <option value="">Sin asignar</option>{members.filter((member) => member.activo).map((member) => <option key={member.id_usuario} value={member.id_usuario}>{member.nombre}</option>)}
      </select>
      <p className={styles.assignmentHint} aria-live="polite">{assignee ? `Asignada a ${members.find((member) => String(member.id_usuario) === assignee)?.nombre ?? "integrante"}` : "Se creará sin asignado"}</p>
      <div className={styles.modalActions}><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={!onCreate || !title.trim()}>Crear tarea</Button></div>
      {!onCreate ? <p className={styles.note}>El guardado se habilitará cuando esté disponible la API de convivencia.</p> : null}
      </form>
    </Modal>
  </div>;
}
