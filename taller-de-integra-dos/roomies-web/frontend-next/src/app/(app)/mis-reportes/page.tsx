import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import ReportsPanel from "@/features/reportes/ReportsPanel";
import type { ReportTarget } from "@/features/reportes/contracts";
import { reportsEnabled } from "@/lib/reportes";

type Query = { usuario?: string | string[]; publicacion?: string | string[] };

function targetId(value: Query["usuario"]) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) notFound();
  return Number(value);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!reportsEnabled()) notFound();
  const { usuario, publicacion } = await searchParams;
  if (usuario !== undefined && publicacion !== undefined) notFound();
  const target: ReportTarget | undefined = usuario !== undefined ? { id_usuario_reportado: targetId(usuario) }
    : publicacion !== undefined ? { id_publicacion_reportada: targetId(publicacion) } : undefined;
  return <main>
    <PageHeader title="Mis reportes" description="Envía un reporte y consulta el estado de los que ya enviaste." />
    <ReportsPanel key={JSON.stringify(target)} target={target} />
  </main>;
}
