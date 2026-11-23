import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { MembersView } from "@/features/recorrido/ConvivenciaViews";
import type { EstadoRecurso, IntegranteArriendoDto } from "@/features/recorrido/types";

export default function MembersPage() {
  const state: EstadoRecurso<IntegranteArriendoDto[]> = { status: "error", message: "La lista de integrantes aún no está disponible. La API de convivencia no está conectada en este entorno." };
  return <main><PageHeader title="Integrantes" description="Arrendador responsable e integrantes activos del arriendo." />
    <p><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p><MembersView state={state} />
  </main>;
}
