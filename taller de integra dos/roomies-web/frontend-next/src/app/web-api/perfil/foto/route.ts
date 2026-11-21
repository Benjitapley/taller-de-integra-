import { handleProfilePhoto } from "@/lib/perfil/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PUT(request: Request) {
  return handleProfilePhoto(request);
}
