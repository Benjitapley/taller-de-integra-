import { handleConvivencia } from "@/lib/recorrido/convivencia";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleConvivencia(request, `/api/tareas/${(await params).id}/estado`);
}
