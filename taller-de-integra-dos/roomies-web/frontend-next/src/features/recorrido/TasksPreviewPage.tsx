"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { TasksView } from "./ConvivenciaViews";
import type { EstadoRecurso, EstadoTarea, IntegranteArriendoDto, TareaDto } from "./types";
import styles from "./recorrido.module.css";

export default function TasksPreviewPage() {
  const [state, setState] = useState<EstadoRecurso<TareaDto[]>>({ status: "loading" });
  const [members, setMembers] = useState<IntegranteArriendoDto[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number>();
  const [rentalId, setRentalId] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<EstadoTarea | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const deny = useCallback(() => {
    setState({ status: "forbidden" }); setMembers([]); setCursor(null);
    setRentalId(null); setCurrentUserId(undefined); setNotice(""); setError("");
  }, []);
  const load = useCallback(async () => {
    const version = ++generation.current;
    const check = (response: Response) => {
      if (!response.ok) throw Object.assign(new Error(), { status: response.status });
      return response;
    };
    try {
      const rental = await (check(await fetch("/web-api/arriendos/mio", { cache: "no-store" }))).json();
      if (version !== generation.current) return;
      const query = new URLSearchParams(filter ? { estado: filter } : {});
      const [tasks, session] = await Promise.all([
        fetch(`/web-api/arriendos/${rental.id_arriendo}/tareas?${query}`, { cache: "no-store" }).then(check).then(r => r.json()),
        fetch("/web-api/auth/sesion", { cache: "no-store" }).then(check).then(r => r.json()),
      ]);
      const people: IntegranteArriendoDto[] = [];
      const seen = new Set<string>();
      let next: string | null = null;
      do {
        const q: URLSearchParams = new URLSearchParams({ activos: "true", ...(next ? { cursor: next } : {}) });
        const page: { items: IntegranteArriendoDto[]; siguiente_cursor: string | null } = await (check(await fetch(`/web-api/arriendos/${rental.id_arriendo}/integrantes?${q}`, { cache: "no-store" }))).json();
        if (version !== generation.current) return;
        people.push(...page.items.filter((member: IntegranteArriendoDto) => member.activo));
        next = page.siguiente_cursor;
        if (next && seen.has(next)) throw new Error();
        if (next) seen.add(next);
      } while (next);
      if (version !== generation.current) return;
      setRentalId(rental.id_arriendo); setState({ status: "ready", data: tasks.items });
      setCursor(tasks.siguiente_cursor); setMembers([...new Map(people.map(p => [p.id_usuario, p])).values()]);
      setCurrentUserId(session.user?.id_usuario); setError("");
    } catch (failure) {
      if (version !== generation.current) return;
      const status = (failure as { status?: number }).status;
      if (status && [401,403,404].includes(status)) deny();
      else setState({ status: "error", message: "No pudimos cargar las tareas. Intenta nuevamente." });
    }
  }, [filter, deny]);
  useEffect(() => {
    const token = generation;
    queueMicrotask(() => void load());
    return () => { token.current++; };
  }, [load]);
  async function mutate(path: string, method: string, body: object): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    const version = generation.current;
    try {
      const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify(body) });
      if (version !== generation.current) return false;
      if (response.status === 401 || response.status === 404) { deny(); return false; }
      if (!response.ok) {
        // A 403 can mean a stale assignment, not necessarily loss of membership.
        if (response.status === 403) {
          const membership = await fetch("/web-api/arriendos/mio", { cache: "no-store" });
          if (version !== generation.current) return false;
          if ([401,403,404].includes(membership.status)) { deny(); return false; }
        }
        const result = await response.json();
        throw new Error(result.detail || "No se pudo confirmar el cambio.");
      }
      const saved: TareaDto = await response.json();
      if (version !== generation.current) return false;
      setState(current => {
        if (current.status !== "ready") return current;
        const rows = current.data.filter(task => task.id_tarea !== saved.id_tarea);
        if (!filter || saved.estado === filter) rows.push(saved);
        return { status: "ready", data: rows.sort((a,b) => a.id_tarea - b.id_tarea) };
      });
      setNotice(method === "POST" ? "Tarea creada. Cambios guardados." : "Cambios guardados.");
      return true;
    } catch (failure) {
      if (version === generation.current) setError(`${failure instanceof Error ? failure.message : "No se pudo confirmar el cambio."} Se conserva el estado anterior. Actualiza antes de reintentar.`);
      return false;
    } finally { pending.current = false; setBusy(false); }
  }
  async function more() {
    if (!cursor || !rentalId || pending.current) return;
    const version = generation.current;
    pending.current = true; setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ cursor, ...(filter ? { estado: filter } : {}) });
      const response = await fetch(`/web-api/arriendos/${rentalId}/tareas?${query}`, { cache: "no-store" });
      if (version !== generation.current) return;
      if ([401,403,404].includes(response.status)) { deny(); return; }
      if (!response.ok) throw new Error();
      const page = await response.json();
      if (version !== generation.current) return;
      setState(current => current.status === "ready" ? { status: "ready", data: [...new Map([...current.data, ...page.items].map((task: TareaDto) => [task.id_tarea, task])).values()] } : current);
      setCursor(page.siguiente_cursor);
    } catch { if (version === generation.current) setError("No se pudieron cargar más tareas. Puedes reintentar."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main>
    <PageHeader title="Tareas del arriendo" description="Organiza las responsabilidades del hogar." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    {state.status !== "forbidden" ? <div className={styles.taskToolbar}>
      <label>Estado <select aria-label="Filtrar por estado" value={filter} disabled={busy || state.status === "loading"} onChange={event => {
        generation.current++; setFilter(event.target.value as EstadoTarea | ""); setCursor(null); setState({ status: "loading" }); setNotice(""); setError("");
      }}><option value="">Todas</option><option value="Pendiente">Pendientes</option><option value="Completada">Completadas</option></select></label>
      <Button variant="secondary" disabled={busy || state.status === "loading"} onClick={() => { setState({ status: "loading" }); setNotice(""); void load(); }}>Actualizar tareas</Button>
    </div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {busy ? <p role="status">Guardando o cargando tareas…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <TasksView state={state} members={members} busy={busy} currentUserId={currentUserId} error={error} onRetry={() => void load()}
      onCreate={busy || !rentalId ? undefined : input => mutate(`/web-api/arriendos/${rentalId}/tareas`, "POST", input)}
      onAssign={(id, id_asignado) => void mutate(`/web-api/tareas/${id}`, "PATCH", { id_asignado })}
      onComplete={id => void mutate(`/web-api/tareas/${id}/estado`, "PATCH", { estado: "Completada" })} />
    {cursor && state.status === "ready" ? <Button disabled={busy} onClick={() => void more()}>Más tareas</Button> : null}
  </main>;
}
