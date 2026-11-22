import { handleMyRental } from "@/lib/arriendos/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleMyRental(request);
}
