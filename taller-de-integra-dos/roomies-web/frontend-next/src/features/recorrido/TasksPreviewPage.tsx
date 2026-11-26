"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import DevelopmentReviewControl from "@/features/recorrido/DevelopmentReviewControl";
import { TasksView } from "@/features/recorrido/ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto, TareaDto } from "@/features/recorrido/types";

type ReviewState = "ready" | "empty" | "loading" | "error" | "forbidden";
const isDevelopment = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ROOMIES_VISUAL_REVIEW === "true";
const unavailable: EstadoRecurso<TareaDto[]> = { status: "error", message: "Las tareas aún no están disponibles. La API de convivencia no está conectada en este entorno." };
const sampleTasks: TareaDto[] = [{ id_tarea: 1, id_arriendo: 1, titulo: "Ordenar la cocina (muestra)", descripcion: "Después de la cena", estado: "Pendiente", id_creador: 1, id_asignado: null, fecha_creacion: "2026-11-22T12:00:00.000Z" }];
function stateForPreview(state: ReviewState): EstadoRecurso<TareaDto[]> {
  if (state === "ready") return { status: "ready", data: sampleTasks };
  if (state === "empty") return { status: "ready", data: [] };
  if (state === "loading") return { status: "loading" };
  if (state === "forbidden") return { status: "forbidden" };
  return { status: "error", message: "No pudimos cargar las tareas. Intenta nuevamente." };
}

export default function TasksPreviewPage() {
  const [preview, setPreview] = useState<ReviewState>("ready");
  const [state, setState] = useState<EstadoRecurso<TareaDto[]>>(() => isDevelopment ? stateForPreview("ready") : unavailable);
  const members: IntegranteArriendoDto[] = [];
  function changePreview(next: ReviewState) { setPreview(next); setState(stateForPreview(next)); }
  function createLocalTask(input: { titulo: string; descripcion: string; id_asignado: number | null }) {
    if (!isDevelopment) return;
    const task: TareaDto = { id_tarea: Date.now(), id_arriendo: 0, ...input, estado: "Pendiente", id_creador: 0, fecha_creacion: new Date().toISOString() };
    setState(current => ({ status: "ready", data: [...(current.status === "ready" ? current.data : []), task] }));
    setPreview("ready");
  }
  return <main>
    <PageHeader title="Tareas del arriendo" description="Organiza las responsabilidades del hogar." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    {isDevelopment ? <DevelopmentReviewControl label="Estado de tareas" value={preview} onChange={changePreview} options={[
      { value: "ready", label: "Lista revisable / crear tarea local" }, { value: "empty", label: "Sin tareas" },
      { value: "loading", label: "Cargando" }, { value: "error", label: "Error recuperable" }, { value: "forbidden", label: "Acceso retirado (403)" },
    ]} /> : null}
    <TasksView state={state} members={members} onCreate={isDevelopment && state.status === "ready" ? createLocalTask : undefined} />
  </main>;
}
