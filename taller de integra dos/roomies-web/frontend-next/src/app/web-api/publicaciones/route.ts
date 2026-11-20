import { handleCreatePublication } from "@/lib/publicaciones/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleCreatePublication(request);
}
