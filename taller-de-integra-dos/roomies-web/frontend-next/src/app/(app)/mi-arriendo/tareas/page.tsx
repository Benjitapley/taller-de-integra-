import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { TasksView } from "@/features/recorrido/ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto, TareaDto } from "@/features/recorrido/types";

export default function TasksPage() {
  const state: EstadoRecurso<TareaDto[]> = { status: "error", message: "Las tareas aún no están disponibles. La API de convivencia no está conectada en este entorno." };
  const members: IntegranteArriendoDto[] = [];
  return <main><PageHeader title="Tareas del arriendo" description="Organiza las responsabilidades del hogar." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p><TasksView state={state} members={members} />
  </main>;
}
