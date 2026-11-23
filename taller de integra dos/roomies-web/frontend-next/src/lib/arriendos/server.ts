import "server-only";
import { authConfig, authReply, readToken, sessionCookie, type Transport, type WebAuthConfig } from "../auth/gateway";

function positiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export async function handleMyRental(
  request: Request,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
): Promise<Response> {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!config) return authReply(503, { detail: "El arriendo no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();
  try {
    const response = await transport(`${config.backend}/api/arriendos/mio`, {
      method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) return expired();
    if (response.status === 404) return authReply(404, { detail: "No tienes un arriendo activo." });
    if (response.status === 403) return authReply(403, { detail: "No tienes acceso a este arriendo." });
    if (!response.ok) return authReply(503, { detail: "No se pudo cargar tu arriendo." });
    const value: unknown = await response.json();
    if (!value || typeof value !== "object") throw new Error();
    const row = value as Record<string, unknown>;
    if (!positiveId(row.id_arriendo) || !positiveId(row.id_publicacion)) throw new Error();
    return authReply(200, row);
  } catch {
    return authReply(503, { detail: "No se pudo cargar tu arriendo." });
  }
}

export async function handleMembers(
  request: Request,
  rentalId: string,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
  query = new URL(request.url).searchParams,
): Promise<Response> {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!/^[1-9]\d{0,9}$/.test(rentalId)) return authReply(400, { detail: "Arriendo inválido." });
  if (!config) return authReply(503, { detail: "Los integrantes no están disponibles." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  try {
    const limit = query.get("limite") ?? "20";
    const cursor = query.get("cursor");
    if (!/^(?:[1-9]|[1-9]\d|100)$/.test(limit) || (cursor !== null && (!cursor || cursor.length > 2048))) return authReply(400, { detail: "Paginación inválida." });
    const params = new URLSearchParams({ activos: "true", limite: limit });
    if (cursor) params.set("cursor", cursor);
    const response = await transport(`${config.backend}/api/arriendos/${rentalId}/integrantes?${params}`, {
      method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if ([401, 403, 404].includes(response.status)) return authReply(response.status, { detail: response.status === 404 ? "Arriendo no encontrado." : "No tienes acceso a los integrantes." });
    if (!response.ok) return authReply(503, { detail: "No se pudieron cargar los integrantes." });
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("items" in value) || !Array.isArray(value.items) || !("siguiente_cursor" in value) ||
        (value.siguiente_cursor !== null && (typeof value.siguiente_cursor !== "string" || value.siguiente_cursor.length > 2048))) throw new Error();
    return authReply(200, value);
  } catch {
    return authReply(503, { detail: "No se pudieron cargar los integrantes." });
  }
}

export async function handleRentalById(request: Request, rentalId: string, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!/^[1-9]\d{0,9}$/.test(rentalId)) return authReply(400, { detail: "Arriendo inválido." });
  if (!config) return authReply(503, { detail: "El arriendo no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  try {
    const response = await transport(`${config.backend}/api/arriendos/${rentalId}`, { method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    if ([401, 403, 404].includes(response.status)) return authReply(response.status, { detail: response.status === 404 ? "Arriendo no encontrado." : "No tienes acceso a este arriendo." });
    if (!response.ok) return authReply(503, { detail: "No se pudo cargar el arriendo." });
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const row = value as Record<string, unknown>;
    if (!["id_arriendo", "id_publicacion"].every(key => Number.isSafeInteger(row[key]) && Number(row[key]) > 0) ||
        !["cupos_totales", "version_capacidad", "ocupacion"].every(key => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0) || typeof row.es_dueno !== "boolean") throw new Error();
    return authReply(200, row);
  } catch { return authReply(503, { detail: "No se pudo cargar el arriendo." }); }
}

export async function handleOwnerRental(request: Request, publicationId: string, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!/^[1-9]\d{0,9}$/.test(publicationId)) return authReply(400, { detail: "Publicación inválida." });
  if (!config) return authReply(503, { detail: "El arriendo no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  try {
    const response = await transport(`${config.backend}/api/arriendos/por-publicacion/${publicationId}`, { method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    if ([401, 403, 404].includes(response.status)) return authReply(response.status, { detail: response.status === 404 ? "La publicación no tiene un arriendo activo." : "No tienes acceso a este arriendo." });
    if (!response.ok) return authReply(503, { detail: "No se pudo cargar el arriendo." });
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const row = value as Record<string, unknown>;
    if (row.id_publicacion !== Number(publicationId) || !["id_arriendo", "id_publicacion"].every(key => Number.isSafeInteger(row[key]) && Number(row[key]) > 0) ||
        !["cupos_totales", "version_capacidad", "ocupacion"].every(key => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0) || row.es_dueno !== true) throw new Error();
    return authReply(200, row);
  } catch { return authReply(503, { detail: "No se pudo cargar el arriendo." }); }
}

export async function handleExpulsion(
  request: Request,
  rentalId: string,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
): Promise<Response> {
  if (request.method !== "POST") return authReply(405, { detail: "Método no permitido." }, { Allow: "POST" });
  if (!/^[1-9]\d{0,9}$/.test(rentalId)) return authReply(400, { detail: "Arriendo inválido." });
  if (!config) return authReply(503, { detail: "El retiro no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    return authReply(403, { detail: "Origen no permitido." });
  }
  let body: { id_usuario: number; motivo: string; confirmo: true };
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some(key => !["id_usuario", "motivo", "confirmo"].includes(key))) throw new Error();
    if (!positiveId(row.id_usuario) || typeof row.motivo !== "string" || row.motivo.trim().length < 1 || row.motivo.length > 500 || row.confirmo !== true) throw new Error();
    body = { id_usuario: row.id_usuario, motivo: row.motivo.trim(), confirmo: true };
  } catch {
    return authReply(422, { detail: "Indica el integrante, un motivo y confirma el retiro." });
  }
  try {
    const response = await transport(`${config.backend}/api/arriendos/${rentalId}/expulsiones`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if ([401, 403, 404, 409, 422].includes(response.status)) {
      let detail = "No se pudo retirar al integrante.";
      try { const payload = await response.json(); if (typeof payload?.detail === "string") detail = payload.detail; } catch {}
      return authReply(response.status, { detail });
    }
    if (!response.ok) return authReply(503, { detail: "No se pudo retirar al integrante." });
    return authReply(200, await response.json());
  } catch {
    return authReply(503, { detail: "No se pudo retirar al integrante." });
  }
}
