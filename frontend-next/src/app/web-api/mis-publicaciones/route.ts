import { authConfig, authReply, readToken, sessionCookie } from "@/lib/auth/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = authConfig();
  if (!config) return authReply(503, { detail: "Listado de publicaciones no disponible en este entorno." });

  const token = readToken(request.headers.get("cookie"), config);
  if (!token) {
    return authReply(401, { detail: "Tu sesión ha expirado o no está disponible." }, { "Set-Cookie": sessionCookie(config) });
  }

  try {
    const response = await fetch(`${config.backend}/api/mis-publicaciones`, {
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
      return authReply(response.status, { detail: "Tu sesión ha expirado o ya no tienes permiso para ver estas publicaciones." }, { "Set-Cookie": sessionCookie(config) });
    }

    if (!response.ok) {
      return authReply(503, { detail: "No se pudieron cargar tus publicaciones." });
    }

    return Response.json(await response.json());
  } catch {
    return authReply(503, { detail: "No se pudieron cargar tus publicaciones." });
  }
}
