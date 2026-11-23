import { handleRentalById } from "@/lib/arriendos/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRentalById(request, (await context.params).id);
}
