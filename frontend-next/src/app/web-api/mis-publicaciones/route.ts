import { handlePublicationRequest } from "@/lib/publicaciones/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return handlePublicationRequest(request, "mine"); }
