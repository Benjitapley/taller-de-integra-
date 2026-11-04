import { authConfig, authReply, readToken, sessionCookie } from "@/lib/auth/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

export async function GET() {
  const config = authConfig();
  if (!config) return authReply(503, { detail: "El catálogo de publicaciones no está disponible." });

  try {
    const response = await fetch(`${config.backend}/api/publicaciones`, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return authReply(response.status === 404 ? 404 : 503, { detail: "No se pudo consultar el catálogo de publicaciones." });
    }

    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return authReply(503, { detail: "No se pudo consultar el catálogo de publicaciones." });
  }
}

export async function POST(request: Request) {
  const config = authConfig();
  if (!config) return authReply(503, { detail: "La creación de publicaciones no está disponible." });

  const token = readToken(request.headers.get("cookie"), config);
  if (!token) {
    return authReply(401, { detail: "Tu sesión ha expirado o no está disponible." }, { "Set-Cookie": sessionCookie(config) });
  }

  try {
    const form = await request.formData();
    const response = await fetch(`${config.backend}/api/publicaciones`, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    if ([401, 403].includes(response.status)) {
      return authReply(response.status, { detail: "Tu sesión ha expirado o no tienes permiso para crear publicaciones." }, { "Set-Cookie": sessionCookie(config) });
    }

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      return Response.json(typeof payload === "object" && payload && "detail" in payload ? payload : { detail: "No se pudo guardar la publicación." }, {
        status: response.status || 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return Response.json(payload ?? { success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return authReply(503, { detail: "No se pudo guardar la publicación." });
  }
}
