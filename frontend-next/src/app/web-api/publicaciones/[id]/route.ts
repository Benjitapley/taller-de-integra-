import { authConfig, authReply, readToken, sessionCookie } from "@/lib/auth/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

async function route(request: Request, context: Context) {
  const config = authConfig();
  if (!config) return authReply(503, { detail: "La gestión de publicaciones no está disponible." });

  const token = readToken(request.headers.get("cookie"), config);
  if (!token) {
    return authReply(401, { detail: "Tu sesión ha expirado o no está disponible." }, { "Set-Cookie": sessionCookie(config) });
  }

  const id = (await context.params).id;
  const url = `${config.backend}/api/publicaciones/${encodeURIComponent(id)}`;

  try {
    if (request.method === "GET") {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      if ([401, 403].includes(response.status)) {
        return authReply(response.status, { detail: "La publicación no está disponible o no tienes permiso para verla." }, { "Set-Cookie": sessionCookie(config) });
      }

      if (!response.ok) {
        return authReply(response.status === 404 ? 404 : 503, { detail: response.status === 404 ? "Publicación no encontrada." : "No se pudo cargar la publicación." });
      }

      return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
    }

    if (request.method === "DELETE") {
      const response = await fetch(url, {
        method: "DELETE",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      if ([401, 403].includes(response.status)) {
        return authReply(response.status, { detail: "No tienes permiso para eliminar esta publicación." }, { "Set-Cookie": sessionCookie(config) });
      }

      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        return Response.json(typeof payload === "object" && payload && "detail" in payload ? payload : { detail: "No se pudo eliminar la publicación." }, {
          status: response.status || 500,
          headers: { "Cache-Control": "no-store" },
        });
      }

      return Response.json(payload ?? { success: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (request.method === "PUT") {
      const form = await request.formData();
      const response = await fetch(url, {
        method: "PUT",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body: form,
      });

      if ([401, 403].includes(response.status)) {
        return authReply(response.status, { detail: "No tienes permiso para editar esta publicación." }, { "Set-Cookie": sessionCookie(config) });
      }

      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        return Response.json(typeof payload === "object" && payload && "detail" in payload ? payload : { detail: "No se pudo guardar la publicación." }, {
          status: response.status || 500,
          headers: { "Cache-Control": "no-store" },
        });
      }

      return Response.json(payload ?? { success: true }, { headers: { "Cache-Control": "no-store" } });
    }

    return authReply(405, { detail: "Método no permitido." }, { Allow: "GET, PUT, DELETE" });
  } catch {
    return authReply(503, { detail: "No se pudo completar la operación de la publicación." });
  }
}

export { route as GET, route as PUT, route as DELETE };
