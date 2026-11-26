import { handleTaskPatch } from "@/lib/recorrido/tasks";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleTaskPatch(request, (await params).id, true);
}
