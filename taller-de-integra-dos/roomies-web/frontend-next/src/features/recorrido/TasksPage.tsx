"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { TasksView } from "./ConvivenciaViews";
import { useCursorList } from "../lists/useCursorList";
import ListProgress from "../lists/ListProgress";
import { applicationRequest, ApplicationRequestError } from "../publicaciones/application-client";
import type { ArriendoDto, IntegranteArriendoDto, TareaDto } from "./types";

const taskId = (task: TareaDto) => task.id_tarea;
const memberId = (member: IntegranteArriendoDto) => member.id_usuario;
export default function TasksPage() {
  const [rental, setRental] = useState<ArriendoDto | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const tasks = useCursorList<TareaDto>(`/web-api/arriendos/${rental?.id_arriendo ?? 0}/tareas`, taskId, Boolean(rental) && !denied);
  const members = useCursorList<IntegranteArriendoDto>(`/web-api/arriendos/${rental?.id_arriendo ?? 0}/integrantes?activos=true`, memberId, Boolean(rental) && !denied);
  useEffect(() => {
    const controller = new AbortController();
    void applicationRequest<ArriendoDto>("/web-api/arriendos/mio", { signal: controller.signal }).then(setRental).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApplicationRequestError && [401, 403, 404].includes(failure.status)) setDenied(true);
      else setError("No pudimos cargar tu arriendo. Actualiza la página.");
    });
    return () => controller.abort();
  }, []);
  async function mutate(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    if (lock.current || denied) return false;
    lock.current = true; setSaving(true); setError("");
    try {
      const saved = await applicationRequest<TareaDto>(path, { method, headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify(body) });
      if (method === "POST") await tasks.load();
      else tasks.setItems(current => current.map(task => task.id_tarea === saved.id_tarea ? saved : task));
      return true;
    } catch (failure) {
      if (failure instanceof ApplicationRequestError && [401, 403, 404].includes(failure.status)) {
        // A forbidden completion may mean wrong assignee; recheck membership before revoking.
        try { const latest = await applicationRequest<ArriendoDto>("/web-api/arriendos/mio"); if (latest.id_arriendo !== rental?.id_arriendo) throw new Error(); }
        catch { setDenied(true); setRental(null); tasks.setItems([]); members.setItems([]); }
      }
      setError(failure instanceof Error ? failure.message : "No pudimos guardar los cambios."); return false;
    } finally { lock.current = false; setSaving(false); }
  }
  if (denied) return <main><h1>Acceso retirado</h1><p>Ya no tienes acceso a las tareas de este arriendo.</p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></main>;
  return <main>
    <PageHeader title="Tareas del arriendo" description="Organiza las responsabilidades del hogar." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    <Button variant="secondary" disabled={tasks.loading} onClick={() => { void tasks.load(); void members.load(); }}>Actualizar</Button>
    {!rental && error ? <p role="alert">{error}</p> : null}
    <TasksView state={tasks.loaded ? { status: "ready", data: tasks.items } : tasks.error ? { status: "error", message: tasks.error } : { status: "loading" }}
      members={members.items} currentUserId={rental?.id_usuario_actual} saving={saving} actionError={error}
      onCreate={input => mutate(`/web-api/arriendos/${rental?.id_arriendo}/tareas`, "POST", input)}
      onAssign={(id, assignee) => void mutate(`/web-api/tareas/${id}`, "PATCH", { id_asignado: assignee })}
      onComplete={id => void mutate(`/web-api/tareas/${id}/estado`, "PATCH", { estado: "Completada" })} />
    {rental ? <ListProgress loading={tasks.loading} error={tasks.error} loaded={tasks.loaded} cursor={tasks.cursor} count={tasks.items.length} retry={tasks.retryLoad} more={() => void tasks.load(tasks.cursor)} /> : null}
    {members.error ? <p role="alert">No pudimos cargar integrantes. <Button variant="secondary" onClick={members.retryLoad}>Reintentar integrantes</Button></p> : null}
    {members.cursor ? <Button variant="secondary" disabled={members.loading} onClick={() => void members.load(members.cursor)}>Cargar más integrantes para asignar</Button> : null}
  </main>;
}
