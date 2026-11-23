import { handleOwnerRental } from "@/lib/arriendos/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleOwnerRental(request, (await context.params).id);
}
