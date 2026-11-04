import { authConfig, authReply, readToken, sessionCookie } from "@/lib/auth/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = authConfig();
  if (!config) return authReply(503, { detail: "El listado de postulaciones no está disponible." });

  const token = readToken(request.headers.get("cookie"), config);
  if (!token) {
    return authReply(401, { detail: "Tu sesión ha expirado o no está disponible." }, { "Set-Cookie": sessionCookie(config) });
  }

  try {
    const response = await fetch(`${config.backend}/conexiones/enviadas`, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if ([401, 403].includes(response.status)) {
      return authReply(response.status, { detail: "Tu sesión ha expirado o no tienes permiso para ver estas postulaciones." }, { "Set-Cookie": sessionCookie(config) });
    }

    if (!response.ok) {
      return authReply(503, { detail: "No se pudieron cargar tus postulaciones." });
    }

    const body = await response.json();
    if (!Array.isArray(body)) return authReply(502, { detail: "El servicio devolvió una respuesta no válida para tus postulaciones." });
    return Response.json(body, { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
  } catch {
    return authReply(503, { detail: "No se pudieron cargar tus postulaciones." });
  }
}
