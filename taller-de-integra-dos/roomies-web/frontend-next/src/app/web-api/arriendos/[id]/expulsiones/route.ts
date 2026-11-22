import { handleExpulsion } from "@/lib/arriendos/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleExpulsion(request, id);
}
