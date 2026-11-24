import { handleArriendoById } from "@/lib/recorrido/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleArriendoById(request, (await params).id);
}
