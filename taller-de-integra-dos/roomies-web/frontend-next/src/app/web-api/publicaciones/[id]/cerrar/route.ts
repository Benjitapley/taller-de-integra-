import { handlePublicationRequest } from "@/lib/publicaciones/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handlePublicationRequest(request, "close", (await context.params).id);
}
