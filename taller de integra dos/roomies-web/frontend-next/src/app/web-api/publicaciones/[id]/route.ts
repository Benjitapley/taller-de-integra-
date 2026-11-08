import { handlePublicationRequest, handleSavePublication } from "@/lib/publicaciones/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return handlePublicationRequest(request, "edit", (await context.params).id);
}
export async function PUT(request: Request, context: Context) {
  return handleSavePublication(request, undefined, undefined, (await context.params).id);
}
