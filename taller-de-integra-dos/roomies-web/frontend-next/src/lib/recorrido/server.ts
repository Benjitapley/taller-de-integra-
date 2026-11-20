import "server-only";
import { authConfig, authReply, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "../auth/gateway";

export async function handleMyArriendo(
  request: Request,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
) {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!config) return authReply(503, { detail: "Mi arriendo no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  try {
    const response = await upstream(config, "/api/arriendos/mio", token, undefined, transport);
    if (response.status === 401) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
    if (response.status === 403) return authReply(403, { detail: "No tienes acceso a este arriendo." });
    if (response.status === 404) return authReply(404, { detail: "Todavía no tienes un arriendo activo." });
    if (!response.ok) return authReply(503, { detail: "No se pudo cargar tu arriendo." });
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    const row = data as Record<string, unknown>;
    if (!Number.isSafeInteger(row.id_arriendo) || Number(row.id_arriendo) < 1 ||
        !Number.isSafeInteger(row.id_publicacion) || Number(row.id_publicacion) < 1 ||
        !["cupos_totales", "integrantes_activos", "cupos_disponibles"].every((key) => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0) ||
        !["Activo", "Finalizado"].includes(String(row.estado))) throw new Error();
    return authReply(200, row);
  } catch {
    return authReply(503, { detail: "No se pudo cargar tu arriendo." });
  }
}

