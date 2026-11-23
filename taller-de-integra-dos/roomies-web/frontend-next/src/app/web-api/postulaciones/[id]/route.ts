import { handleApplications } from "@/lib/publicaciones/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApplications(request, undefined, undefined, (await context.params).id);
}
