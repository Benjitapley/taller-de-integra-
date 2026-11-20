import { notFound } from "next/navigation";
import { ReportQueue } from "@/features/admin/ReportModeration";
import { reportsEnabled } from "@/lib/reportes";

export default function ReportQueuePage() {
  if (!reportsEnabled()) notFound();
  return <ReportQueue />;
}
