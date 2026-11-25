import "server-only";
import { authConfig, authReply, limitedJson, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "../auth/gateway";

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
    const original = data as Record<string, unknown>;
    // SCRUM-124 returns active membership with occupancy and capacity version.
    const canonical = Number.isSafeInteger(original.version_capacidad) && Number(original.version_capacidad) > 0;
    const row = canonical ? { ...original, estado: original.estado ?? "Activo", integrantes_activos: original.ocupacion,
      cupos_disponibles: Number(original.cupos_totales) - Number(original.ocupacion) } : original;
    if (!Number.isSafeInteger(row.id_arriendo) || Number(row.id_arriendo) < 1 ||
        !Number.isSafeInteger(row.id_publicacion) || Number(row.id_publicacion) < 1 ||
        !["cupos_totales", "integrantes_activos", "cupos_disponibles"].every((key) => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0) ||
        !["Activo", "Finalizado"].includes(String(row.estado)) ||
        Number(row.integrantes_activos) + Number(row.cupos_disponibles) !== row.cupos_totales) throw new Error();
    return authReply(200, {
      id_arriendo: row.id_arriendo, id_publicacion: row.id_publicacion, estado: row.estado,
      cupos_totales: row.cupos_totales, integrantes_activos: row.integrantes_activos,
      cupos_disponibles: row.cupos_disponibles,
      id_responsable: Number.isSafeInteger(row.id_responsable) && Number(row.id_responsable) > 0 ? row.id_responsable : null,
    });
  } catch {
    return authReply(503, { detail: "No se pudo cargar tu arriendo." });
  }
}

/** Rental detail is deliberately passed through an authenticated request.
 * Convivencia remains the authority for resident/owner access; the BFF never
 * infers permission from a publication URL or an admin role.
 */
export async function handleArriendoById(
  request: Request,
  rentalId: string,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
) {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!/^[1-9][0-9]{0,9}$/.test(rentalId) || !Number.isSafeInteger(Number(rentalId))) return authReply(400, { detail: "Identificador inválido." });
  if (!config) return authReply(503, { detail: "El arriendo no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  try {
    const response = await upstream(config, `/api/arriendos/${rentalId}`, token, undefined, transport);
    if (response.status === 401) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
    if (response.status === 403) return authReply(403, { detail: "No tienes permiso para consultar este arriendo." });
    if (response.status === 404) return authReply(404, { detail: "No se encontró un arriendo disponible para tu cuenta." });
    if (!response.ok) return authReply(503, { detail: "No se pudo cargar el arriendo." });
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    const row = data as Record<string, unknown>;
    const canonical = Number.isSafeInteger(row.version_capacidad) && Number(row.version_capacidad) > 0;
    const normalized = canonical ? { ...row, estado: row.estado ?? "Activo", integrantes_activos: row.ocupacion,
      cupos_disponibles: Number(row.cupos_totales) - Number(row.ocupacion) } : row;
    if (Number(normalized.id_arriendo) !== Number(rentalId) || !Number.isSafeInteger(normalized.id_publicacion) || Number(normalized.id_publicacion) < 1 ||
        !["cupos_totales", "integrantes_activos", "cupos_disponibles"].every(key => Number.isSafeInteger(normalized[key]) && Number(normalized[key]) >= 0) ||
        !["Activo", "Finalizado"].includes(String(normalized.estado)) ||
        Number(normalized.integrantes_activos) + Number(normalized.cupos_disponibles) !== Number(normalized.cupos_totales)) throw new Error();
    return authReply(200, {
      id_arriendo: Number(normalized.id_arriendo), id_publicacion: Number(normalized.id_publicacion), estado: normalized.estado,
      cupos_totales: Number(normalized.cupos_totales), integrantes_activos: Number(normalized.integrantes_activos),
      cupos_disponibles: Number(normalized.cupos_disponibles),
      id_responsable: Number.isSafeInteger(normalized.id_responsable) && Number(normalized.id_responsable) > 0 ? Number(normalized.id_responsable) : null,
    });
  } catch {
    return authReply(503, { detail: "No se pudo cargar el arriendo." });
  }
}


export async function handleExpulsion(request: Request, rentalId: string, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (request.method !== "POST") return authReply(405, { detail: "Método no permitido." });
  if (!config) return authReply(503, { detail: "Retiro no disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." });
  if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authReply(403, { detail: "Origen no permitido." });
  const invalid = () => authReply(422, { detail: "Indica un motivo de 1 a 500 caracteres y confirma el retiro." });
  if (!/^[1-9][0-9]{0,9}$/.test(rentalId) || request.headers.get("content-type")?.split(";")[0] !== "application/json") return invalid();
  try {
    let data: Record<string, unknown>;
    try { data = await limitedJson(request); } catch { return invalid(); }
    if (!data || Object.keys(data).some(key => !["id_usuario", "motivo", "confirmo"].includes(key)) ||
        !Number.isSafeInteger(data.id_usuario) || Number(data.id_usuario) < 1 || typeof data.motivo !== "string" ||
        !data.motivo.trim() || data.motivo.length > 500 || data.confirmo !== true) return invalid();
    const response = await transport(`${config.backend}/api/arriendos/${rentalId}/expulsiones`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id_usuario: data.id_usuario, motivo: data.motivo.trim(), confirmo: true }),
    });
    if ([401, 403, 404, 409, 422].includes(response.status)) return authReply(response.status, { detail: response.status === 403 ? "Solo el dueño del aviso puede retirar integrantes." : "No se pudo retirar al integrante. Actualiza la lista y revisa los datos." });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (result.id_arriendo !== Number(rentalId) || result.id_usuario !== data.id_usuario ||
        !["Activo", "Finalizado"].includes(result.estado) ||
        ![result.integrantes_activos, result.cupos_disponibles].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error();
    return authReply(200, { id_arriendo: result.id_arriendo, id_usuario: result.id_usuario, estado: result.estado,
      integrantes_activos: result.integrantes_activos, cupos_disponibles: result.cupos_disponibles });
  } catch { return authReply(503, { detail: "No se pudo confirmar el retiro. Puedes reintentar sin liberar otro cupo." }); }
}

/** Lista integrantes usando la autorización de Convivencia y conserva su paginación. */
export async function handleRentalMembers(
  request: Request,
  rental: string,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
) {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!config) return authReply(503, { detail: "La lista de integrantes no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  const query = new URL(request.url).searchParams;
  if (!/^[1-9][0-9]*$/.test(rental) || !Number.isSafeInteger(Number(rental)) ||
      [...query.keys()].some((key) => !["cursor", "activos"].includes(key) || query.getAll(key).length !== 1)) {
    return authReply(422, { detail: "Revisa la consulta de integrantes." });
  }
  if (query.has("activos") && query.get("activos") !== "true") return authReply(422, { detail: "Consulta de integrantes inv?lida." });
  const cursor = query.get("cursor");
  if (cursor !== null && !/^[A-Za-z0-9_.-]{1,2048}$/.test(cursor)) {
    return authReply(422, { detail: "Revisa la consulta de integrantes." });
  }
  try {
    const suffix = cursor === null ? "" : `?${new URLSearchParams({ cursor })}`;
    const response = await upstream(config, `/api/arriendos/${rental}/integrantes${suffix}`, token, undefined, transport);
    if (response.status === 401) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
    if (response.status === 403) return authReply(403, { detail: "No tienes permiso para consultar este arriendo." });
    if (response.status === 404) return authReply(404, { detail: "No se encontró el arriendo o la lista de integrantes." });
    if (response.status === 422) return authReply(422, { detail: "Revisa la consulta de integrantes." });
    if (!response.ok) return authReply(503, { detail: "No se pudo cargar la lista de integrantes." });
    const page = await response.json();
    if (!page || !Array.isArray(page.items) || page.items.length > 20 ||
        (page.siguiente_cursor !== null && (typeof page.siguiente_cursor !== "string" || !/^[A-Za-z0-9_.-]{1,2048}$/.test(page.siguiente_cursor)))) throw new Error();
    const items = page.items.map((item: Record<string, unknown>) => {
      if (!item || !Number.isSafeInteger(item.id_usuario) || Number(item.id_usuario) < 1 ||
          typeof item.es_responsable !== "boolean" || typeof item.activo !== "boolean" ||
          typeof item.fecha_ingreso !== "string" || !Number.isFinite(Date.parse(item.fecha_ingreso)) ||
          (item.nombre !== null && (typeof item.nombre !== "string" || item.nombre.length > 200))) throw new Error();
      return { id_usuario: item.id_usuario, nombre: item.nombre, es_responsable: item.es_responsable,
        fecha_ingreso: item.fecha_ingreso, activo: item.activo };
    });
    if (new Set(items.map((item: { id_usuario: number }) => item.id_usuario)).size !== items.length) throw new Error();
    return authReply(200, { items, siguiente_cursor: page.siguiente_cursor,
      ...(typeof page.puede_retirar === "boolean" ? { puede_retirar: page.puede_retirar } : {}),
    });
  } catch {
    return authReply(503, { detail: "No se pudo cargar la lista de integrantes." });
  }
}
