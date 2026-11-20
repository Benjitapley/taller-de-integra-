import { handleApplications } from "@/lib/publicaciones/applications";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(request: Request) { return handleApplications(request); }
export { route as GET, route as POST, route as PATCH };
