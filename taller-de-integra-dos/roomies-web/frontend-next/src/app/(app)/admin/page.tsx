import AdminPanel from "@/features/admin/AdminPanel";
import { reportsEnabled } from "@/lib/reportes";

export default function AdminPage() {
  return <AdminPanel showReports={reportsEnabled()} />;
}
