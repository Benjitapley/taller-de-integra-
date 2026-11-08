import { authConfig, handleAuth } from "@/lib/auth/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
async function handler(request: Request, context: Context) {
  return handleAuth(request, (await context.params).action, authConfig());
}
export { handler as GET, handler as POST };
