import { handleMyArriendo } from "@/lib/recorrido/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleMyArriendo(request, undefined, undefined, (await params).id);
}
