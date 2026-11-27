"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { TareaStatus } from "@/features/recorrido/JourneyStatus";
import type { EstadoTarea, TareaDto } from "@/features/recorrido/types";
import styles from "@/features/recorrido/recorrido.module.css";

type Member = { id_usuario: number; nombre: string | null; activo: true };
type TaskPage = { items: TareaDto[]; siguiente_cursor: string | null; id_usuario_actual: number };
type MemberPage = { items: Member[]; siguiente_cursor: string | null };
type Rental = { id_arriendo: number };

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof body.detail === "string" ? body.detail : "No se pudo completar la operación.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return body as T;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

export default function TasksPage() {
  const [rental, setRental] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersReady, setMembersReady] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [state, setState] = useState<EstadoTarea>("Pendiente");
  const [page, setPage] = useState<TaskPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const requestId = useRef(0);
  const memberRequest = useRef(0);
  const taskPending = useRef<string | null>(null);
  const memberPending = useRef<number | null>(null);
  const taskAttempt = useRef<string | undefined>(undefined);
  const memberAttempt = useRef<string | undefined>(undefined);
  const mutationPending = useRef(false);

  const loadTasks = useCallback(async (id: number, status: EstadoTarea, cursor?: string) => {
    const key = `${id}:${status}:${cursor ?? ""}`;
    if (taskPending.current === key) return;
    taskPending.current = key;
    taskAttempt.current = cursor;
    const current = ++requestId.current;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ estado: status, limite: "20" });
      if (cursor) params.set("cursor", cursor);
      const result = await json<TaskPage>(`/web-api/arriendos/${id}/tareas?${params}`);
      if (current !== requestId.current) return;
      setPage(previous => ({ ...result, items: cursor && previous ? [...new Map([...previous.items, ...result.items].map(task => [task.id_tarea, task])).values()] : result.items }));
    } catch (failure) {
      if (current !== requestId.current) return;
      if ([401,403,404].includes((failure as { status?: number }).status ?? 0)) {
        setRental(null); setPage(null); setMembers([]); setMemberCursor(null); setMembersReady(false);
        memberRequest.current++; memberPending.current = null; setMembersLoading(false);
      }
      setError(errorText(failure));
    } finally { if (current === requestId.current) { setLoading(false); taskPending.current = null; } }
  }, []);

  const loadMembers = useCallback(async (id: number, cursor?: string) => {
    if (memberPending.current !== null) return;
    const current = ++memberRequest.current;
    memberPending.current = current; memberAttempt.current = cursor;
    setMembersLoading(true); setMemberError("");
    try {
      const query = new URLSearchParams({ limite: "20", ...(cursor ? { cursor } : {}) });
      const result = await json<MemberPage>(`/web-api/arriendos/${id}/tareas-integrantes?${query}`);
      if (current !== memberRequest.current) return;
      setMembers(previous => cursor ? [...new Map([...previous, ...result.items].map(member => [member.id_usuario, member])).values()] : result.items);
      setMemberCursor(result.siguiente_cursor); setMembersReady(true);
    } catch (failure) {
      if (current !== memberRequest.current) return;
      if ([401,403,404].includes((failure as { status?: number }).status ?? 0)) {
        setMembers([]); setMembersReady(false); setMemberCursor(null); setRental(null); setPage(null);
        requestId.current++; taskPending.current = null; setLoading(false);
      }
      setMemberError(errorText(failure));
    } finally { if (current === memberRequest.current) { memberPending.current = null; setMembersLoading(false); } }
  }, []);

  useEffect(() => {
    let active = true;
    const currentTasks = requestId, currentMembers = memberRequest;
    void json<Rental>("/web-api/arriendos/mio").then(result => {
      if (!active) return;
      setRental(result.id_arriendo);
      void loadMembers(result.id_arriendo);
      void loadTasks(result.id_arriendo, "Pendiente");
    }).catch(failure => { if (active) { setError(errorText(failure)); setLoading(false); } });
    return () => { active = false; currentTasks.current++; currentMembers.current++; taskPending.current = null; memberPending.current = null; };
  }, [loadMembers, loadTasks]);

  useEffect(() => {
    if (!rental) return;
    const refresh = () => { if (document.visibilityState === "visible") { void loadTasks(rental, state); void loadMembers(rental); } };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [rental, state, loadTasks, loadMembers]);

  function selectState(next: EstadoTarea) {
    if (next === state) return;
    setState(next); setPage(null); setNotice("");
    if (rental) void loadTasks(rental, next);
  }

  async function mutate(path: string, method: "POST" | "PATCH", body: unknown, success: string) {
    if (!rental || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      await json<TareaDto>(path, { method,
        headers: { "Content-Type": "application/json", "x-haycupo-csrf": "1" },
        body: JSON.stringify(body) });
      // No hay cambio optimista: un PATCH fallido conserva exactamente la lista previa.
      setNotice(success);
      await Promise.all([loadTasks(rental, state), loadMembers(rental)]);
      return true;
    } catch (failure) {
      setError(errorText(failure));
      if ((failure as { status?: number }).status === 403) {
        await loadTasks(rental, state);
      }
      return false;
    } finally { mutationPending.current = false; setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rental || !title.trim() || !membersReady) return;
    const saved = await mutate(`/web-api/arriendos/${rental}/tareas`, "POST", {
      titulo: title.trim(), descripcion: description.trim(), id_asignado: assignee ? Number(assignee) : null,
    }, "Tarea guardada.");
    if (saved) { setOpen(false); setTitle(""); setDescription(""); setAssignee(""); }
  }

  const memberName = (id: number | null) => id === null ? "Sin asignar" :
    members.find(member => member.id_usuario === id)?.nombre || `Integrante #${id}`;

  return <main>
    <PageHeader title="Tareas del arriendo" description="Organiza las responsabilidades del hogar." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    <Card className={styles.taskBoard}>
      <div className={styles.sectionHeading}>
        <h2>Organización de la casa</h2>
        <Button variant="secondary" disabled={!rental || !membersReady || busy} onClick={() => setOpen(true)}>＋ Nueva tarea</Button>
      </div>
      <div className={styles.actions} aria-label="Filtrar tareas por estado">
        <Button disabled={busy || !rental || (loading && !page)} variant={state === "Pendiente" ? "primary" : "secondary"} onClick={() => selectState("Pendiente")}>Pendientes</Button>
        <Button disabled={busy || !rental || (loading && !page)} variant={state === "Completada" ? "primary" : "secondary"} onClick={() => selectState("Completada")}>Completadas</Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {memberError && <p role="alert">No se pudieron cargar los integrantes: {memberError} <Button variant="secondary" disabled={membersLoading} onClick={() => rental && void loadMembers(rental, memberAttempt.current)}>Reintentar integrantes</Button></p>}
      {membersLoading && <p role="status">Cargando integrantes…</p>}
      {memberCursor && rental && <Button variant="secondary" disabled={membersLoading} onClick={() => void loadMembers(rental, memberCursor)}>Más integrantes</Button>}
      {membersReady && !memberCursor && !membersLoading && <p>Todos los integrantes cargados.</p>}
      {loading && <p role="status">Cargando tareas…</p>}
      {!loading && error && rental && <Button variant="secondary" onClick={() => void loadTasks(rental, state, taskAttempt.current)}>Reintentar</Button>}
      {!loading && page && page.items.length === 0 && <p>No hay tareas {state.toLowerCase()}s para este arriendo.</p>}
      {page && <ul className={styles.taskList}>{page.items.map(task => {
        const assignedActive = membersReady && members.some(member => member.id_usuario === task.id_asignado);
        const canComplete = task.estado === "Pendiente" && task.id_asignado === page.id_usuario_actual;
        return <li key={task.id_tarea}>
          <div><strong>{task.titulo}</strong>{task.descripcion && <p>{task.descripcion}</p>}
            <small>{memberName(task.id_asignado)}{task.id_asignado !== null && membersReady && !memberCursor && !assignedActive ? " (retirado)" : ""}</small>
          </div>
          <div className={styles.taskControls}>
            <TareaStatus estado={task.estado} />
            {canComplete && <Button disabled={busy} onClick={() => void mutate(`/web-api/tareas/${task.id_tarea}/estado`, "PATCH", { estado: "Completada" }, "Tarea completada y guardada.")}>Completar</Button>}
            {task.estado === "Pendiente" && membersReady && members.length > 0 && <label>
              <span>Reasignar</span>
              <select aria-label={`Reasignar ${task.titulo}`} value={assignments[task.id_tarea] ?? ""}
                onChange={event => setAssignments(current => ({ ...current, [task.id_tarea]: event.target.value }))}
                disabled={busy}>
                <option value="">Selecciona integrante</option>
                {members.map(member => <option key={member.id_usuario} value={member.id_usuario}>{memberName(member.id_usuario)}</option>)}
              </select>
              <Button variant="secondary" disabled={busy || !assignments[task.id_tarea] || Number(assignments[task.id_tarea]) === task.id_asignado}
                onClick={() => void mutate(`/web-api/tareas/${task.id_tarea}`, "PATCH", { id_asignado: Number(assignments[task.id_tarea]) }, "Asignación guardada.")}>Guardar</Button>
            </label>}
          </div>
        </li>;
      })}</ul>}
      {page?.siguiente_cursor && rental && <Button variant="secondary" disabled={loading} onClick={() => void loadTasks(rental, state, page.siguiente_cursor!)}>Más tareas</Button>}
      {page && !page.siguiente_cursor && !loading && <p>Fin de la lista de tareas.</p>}
    </Card>
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Nueva tarea">
      <form className={styles.taskForm} onSubmit={event => void create(event)}>
        <p>Organiza responsabilidades del hogar. La asignación es opcional.</p>
        <label htmlFor="task-title">Nombre de la tarea</label>
        <input id="task-title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} disabled={busy} />
        <label htmlFor="task-description">Descripción (opcional)</label>
        <textarea id="task-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} rows={3} disabled={busy} />
        <label htmlFor="task-assignee">Asignar a (opcional)</label>
        <select id="task-assignee" value={assignee} onChange={event => setAssignee(event.target.value)} disabled={busy}>
          <option value="">Sin asignar</option>
          {members.map(member => <option key={member.id_usuario} value={member.id_usuario}>{memberName(member.id_usuario)}</option>)}
        </select>
        {memberCursor && rental && <Button type="button" variant="secondary" disabled={membersLoading || busy}
          onClick={() => void loadMembers(rental, memberCursor)}>Más integrantes para asignar</Button>}
        {membersLoading && <p role="status">Cargando integrantes…</p>}
        {memberError && <p role="alert">{memberError} <Button type="button" variant="secondary" disabled={membersLoading || busy}
          onClick={() => rental && void loadMembers(rental, memberAttempt.current)}>Reintentar integrantes</Button></p>}
        <div className={styles.formFooter}><span>{assignee ? `Asignada a ${memberName(Number(assignee))}` : "Se creará sin asignado"}</span>
          <Button type="submit" disabled={busy || !title.trim()}>{busy ? "Guardando…" : "Crear tarea"}</Button></div>
        {error && <p role="alert">{error}</p>}
      </form>
    </Modal>
  </main>;
}
