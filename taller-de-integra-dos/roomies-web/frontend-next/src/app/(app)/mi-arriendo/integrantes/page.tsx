"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import DevelopmentReviewControl from "@/features/recorrido/DevelopmentReviewControl";
import { MembersView } from "@/features/recorrido/ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto } from "@/features/recorrido/types";

type ReviewState = "ready" | "empty" | "loading" | "error" | "forbidden";
const isDevelopment = process.env.NODE_ENV === "development";
const sample: IntegranteArriendoDto[] = [
  { id_usuario: 1, nombre: "Pat (responsable residente de muestra)", es_responsable: true, fecha_ingreso: "2026-11-20T12:00:00.000Z", activo: true },
  { id_usuario: 2, nombre: "Alex (integrante de muestra)", es_responsable: false, fecha_ingreso: "2026-11-21T12:00:00.000Z", activo: true },
  { id_usuario: 3, nombre: "Sam (integrante de muestra)", es_responsable: false, fecha_ingreso: "2026-11-22T12:00:00.000Z", activo: true },
];
const unavailable: EstadoRecurso<IntegranteArriendoDto[]> = { status: "error", message: "La lista de integrantes aún no está disponible. La API de convivencia no está conectada en este entorno." };
function stateForPreview(state: ReviewState): EstadoRecurso<IntegranteArriendoDto[]> {
  if (state === "ready") return { status: "ready", data: sample };
  if (state === "empty") return { status: "ready", data: [] };
  if (state === "loading") return { status: "loading" };
  if (state === "forbidden") return { status: "forbidden" };
  return { status: "error", message: "No pudimos cargar la lista de integrantes. Intenta nuevamente." };
}

export default function MembersPage() {
  const [preview, setPreview] = useState<ReviewState>("ready");
  const [state, setState] = useState<EstadoRecurso<IntegranteArriendoDto[]>>(() => isDevelopment ? stateForPreview("ready") : unavailable);
  function changePreview(next: ReviewState) { setPreview(next); setState(stateForPreview(next)); }
  return <main>
    <PageHeader title="Integrantes" description="Responsable de convivencia e integrantes residentes activos." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    {isDevelopment ? <DevelopmentReviewControl label="Estado de integrantes" value={preview} onChange={changePreview} options={[
      { value: "ready", label: "Responsable e integrantes de muestra" }, { value: "empty", label: "Sin integrantes" },
      { value: "loading", label: "Cargando" }, { value: "error", label: "Error recuperable" }, { value: "forbidden", label: "Acceso retirado (403)" },
    ]} /> : null}
    <MembersView state={state} onRetry={isDevelopment && state.status === "error" ? () => changePreview("ready") : undefined} />
  </main>;
}
