import { handleRental } from "@/lib/publicaciones/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRental(request, (await params).id);
}
