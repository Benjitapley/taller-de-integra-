import { handleProfile } from "@/lib/perfil/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleProfile(request);
}
