import ReportAccessState from "@/features/admin/ReportAccessState";
import { adminReportsResponse } from "@/lib/admin/report-access";
import { notFound } from "next/navigation";
import { ReportDetail } from "@/features/admin/ReportModeration";
import { reportsEnabled } from "@/lib/reportes";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!reportsEnabled() || !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const response = await adminReportsResponse(id);
  if ([401, 403].includes(response.status)) return <ReportAccessState status={response.status} />;
  if (response.status === 404) notFound();
  return <ReportDetail id={id} key={id} initialReport={response.ok ? await response.json() : undefined} initialError={response.ok ? undefined : response.status} />;
}
