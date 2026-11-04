import { handleConnections } from "@/lib/conexiones/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(request: Request) { return handleConnections(request); }
export { route as GET, route as POST, route as PUT, route as DELETE };
