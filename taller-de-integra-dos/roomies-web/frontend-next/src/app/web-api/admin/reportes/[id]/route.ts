import { handleAdminReports } from "@/lib/admin/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function handle(request: Request, { params }: Context) {
  const { id } = await params;
  return handleAdminReports(request, id);
}

export { handle as GET, handle as PATCH };
