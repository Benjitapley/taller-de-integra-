import { handleReportMembers } from "@/lib/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleReportMembers(request, (await params).id);
}
