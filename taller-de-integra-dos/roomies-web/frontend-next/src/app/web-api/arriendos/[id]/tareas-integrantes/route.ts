import { handleTaskMembers } from "@/lib/recorrido/tasks";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleTaskMembers(request, (await params).id);
}
