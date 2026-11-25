"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { TasksView } from "./ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto, TareaDto } from "./types";

export default function TasksPreviewPage() {
  const [state, setState] = useState<EstadoRecurso<TareaDto[]>>({ status: "loading" });
  const [members, setMembers] = useState<IntegranteArriendoDto[]>([]);
  const [rentalId, setRentalId] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current;
    try {
      const response = await fetch("/web-api/arriendos/mio", { cache: "no-store" });
      if ([401,403,404].includes(response.status)) { setState({ status: "forbidden" }); setMembers([]); return; }
      if (!response.ok) throw new Error();
      const rental = await response.json();
      const [taskResponse, memberResponse] = await Promise.all([
        fetch(`/web-api/arriendos/${rental.id_arriendo}/tareas`, { cache: "no-store" }),
        fetch(`/web-api/arriendos/${rental.id_arriendo}/integrantes?activos=true`, { cache: "no-store" }),
      ]);
      if (version !== generation.current) return;
      if ([401,403,404].includes(taskResponse.status) || [401,403,404].includes(memberResponse.status)) { setState({ status: "forbidden" }); setMembers([]); setCursor(null); return; }
      if (!taskResponse.ok || !memberResponse.ok) throw new Error();
      const [tasks, people] = await Promise.all([taskResponse.json(), memberResponse.json()]);
      if (version !== generation.current) return;
      setRentalId(rental.id_arriendo); setState({ status: "ready", data: tasks.items }); setCursor(tasks.siguiente_cursor); setMembers(people.items);
    } catch { if (version === generation.current) setState({ status: "error", message: "No pudimos cargar las tareas. Intenta nuevamente." }); }
  }, []);
  useEffect(() => { const token = generation; queueMicrotask(() => void load()); return () => { token.current++; }; }, [load]);
  async function mutate(path: string, method: string, body: object) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify(body) });
      if ([401,403,404].includes(response.status)) { setState({ status: "forbidden" }); setMembers([]); setCursor(null); return; }
      if (!response.ok) throw new Error();
      await load();
    } catch { setError("No se pudo confirmar el cambio. Actualiza las tareas antes de reintentar."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function more() {
    if (!cursor || !rentalId || pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const response = await fetch(`/web-api/arriendos/${rentalId}/tareas?cursor=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      if ([401,403,404].includes(response.status)) { setState({ status: "forbidden" }); setMembers([]); setCursor(null); return; }
      if (!response.ok) throw new Error();
      const page = await response.json();
      setState(current => current.status === "ready" ? { status: "ready", data: [...current.data, ...page.items] } : current); setCursor(page.siguiente_cursor);
    } catch { setError("No se pudieron cargar más tareas."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <main>
    <PageHeader title="Tareas del arriendo" description="Organiza las responsabilidades del hogar." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    {error ? <p role="alert">{error}</p> : null}
    <TasksView state={state} members={members} busy={busy} onRetry={() => void load()}
      onCreate={busy || !rentalId ? undefined : input => void mutate(`/web-api/arriendos/${rentalId}/tareas`, "POST", input)}
      onAssign={(id, id_asignado) => void mutate(`/web-api/tareas/${id}`, "PATCH", { id_asignado })}
      onComplete={id => void mutate(`/web-api/tareas/${id}/estado`, "PATCH", { estado: "Completada" })} />
    {cursor && state.status === "ready" ? <Button disabled={busy} onClick={() => void more()}>Más tareas</Button> : null}
  </main>;
}
