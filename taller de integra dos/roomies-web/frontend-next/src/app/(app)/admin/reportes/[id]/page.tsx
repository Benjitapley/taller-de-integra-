import { notFound } from "next/navigation";
import { ReportDetail } from "@/features/admin/ReportModeration";
import { reportsEnabled } from "@/lib/reportes";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!reportsEnabled() || !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  return <ReportDetail id={id} key={id} />;
}
