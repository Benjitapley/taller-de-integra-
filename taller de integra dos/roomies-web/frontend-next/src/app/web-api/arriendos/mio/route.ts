import { handleRental } from "@/lib/publicaciones/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleRental(request, "mio");
}
