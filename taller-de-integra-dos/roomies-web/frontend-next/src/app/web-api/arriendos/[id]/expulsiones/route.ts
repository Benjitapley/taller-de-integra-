import { handleExpulsion } from "@/lib/recorrido/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleExpulsion(request, (await params).id);
}
