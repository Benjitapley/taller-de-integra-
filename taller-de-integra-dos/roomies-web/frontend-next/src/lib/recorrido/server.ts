import "server-only";
import { authConfig, authReply, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "../auth/gateway";

export async function handleMyArriendo(
  request: Request,
  config: WebAuthConfig | null = authConfig(),
  transport: Transport = fetch,
  rental?: string,
) {
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!config) return authReply(503, { detail: "Mi arriendo no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  try {
    if (rental !== undefined && (!/^[1-9][0-9]*$/.test(rental) || !Number.isSafeInteger(Number(rental)))) return authReply(422, { detail: "Arriendo inv?lido." });
    const response = await upstream(config, rental ? `/api/arriendos/${rental}` : "/api/arriendos/mio", token, undefined, transport);
    if (response.status === 401) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
    if (response.status === 403) return authReply(403, { detail: "No tienes acceso a este arriendo." });
    if (response.status === 404) return authReply(404, { detail: "Todavía no tienes un arriendo activo." });
    if (!response.ok) return authReply(503, { detail: "No se pudo cargar tu arriendo." });
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    const original = data as Record<string, unknown>;
    // SCRUM-124 returns active membership with occupancy and capacity version.
    const canonical = original.estado === undefined && Number.isSafeInteger(original.version_capacidad) && Number(original.version_capacidad) > 0;
    const row = canonical ? { ...original, estado: "Activo", integrantes_activos: original.ocupacion,
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
      [...query.keys()].some((key) => key !== "cursor" || query.getAll(key).length !== 1)) {
    return authReply(422, { detail: "Revisa la consulta de integrantes." });
  }
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
    return authReply(200, { items, siguiente_cursor: page.siguiente_cursor });
  } catch {
    return authReply(503, { detail: "No se pudo cargar la lista de integrantes." });
  }
}
