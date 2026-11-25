import { handleConvivencia } from "@/lib/recorrido/convivencia";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleConvivencia(request, `/api/arriendos/${(await params).id}/expulsiones`);
}
