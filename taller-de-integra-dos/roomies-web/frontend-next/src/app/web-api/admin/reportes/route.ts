import { handleAdminReports } from "@/lib/admin/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleAdminReports(request);
}
