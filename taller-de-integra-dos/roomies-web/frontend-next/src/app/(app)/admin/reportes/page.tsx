import ReportAccessState from "@/features/admin/ReportAccessState";
import { adminReportsResponse } from "@/lib/admin/report-access";
import { notFound } from "next/navigation";
import { ReportQueue } from "@/features/admin/ReportModeration";
import { reportsEnabled } from "@/lib/reportes";

export default async function ReportQueuePage() {
  if (!reportsEnabled()) notFound();
  const response = await adminReportsResponse();
  if ([401, 403].includes(response.status)) return <ReportAccessState status={response.status} />;
  return <ReportQueue initialPage={response.ok ? await response.json() : undefined} initialError={response.ok ? undefined : response.status} />;
}
