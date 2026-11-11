import "server-only";
import { authConfig, authReply, readToken, sessionCookie, type Transport, type WebAuthConfig } from "../auth/gateway";

const views = new Set(["recibidas", "enviadas", "aceptadas"]);
const unavailable = () => authReply(503, { detail: "No se pudo confirmar la operación. Actualiza tus conexiones antes de volver a intentarlo." });

export async function handlePeopleSearch(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config) return authReply(503, { detail: "No se pudo cargar la búsqueda de personas." });
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();
  const query = new URL(request.url).searchParams;
  const allowed = ["presupuesto_max", "zona", "ocupacion"];
  if ([...query.keys()].some(key => !allowed.includes(key) || query.getAll(key).length !== 1)) {
    return authReply(422, { detail: "Revisa los filtros de búsqueda." });
  }
  try {
    const url = new URL("/conexiones/usuarios/otros", config.backend);
    url.search = query.toString();
    const response = await transport(url.toString(), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) return expired();
    if (response.status === 403) return authReply(403, { detail: "Tu cuenta no puede consultar personas." });
    if (response.status === 422) return authReply(422, { detail: "Revisa los filtros de búsqueda." });
    if (!response.ok) throw new Error("búsqueda no disponible");
    const people: unknown = await response.json();
    if (!Array.isArray(people)) throw new Error("respuesta inválida");
    const fields = ["id_usuario_PK", "nombre", "edad", "presupuesto", "zona_interes", "ocupacion"];
    return authReply(200, people.map(person => Object.fromEntries(fields.map(key => [key, person[key]]))));
  } catch {
    return authReply(503, { detail: "No se pudo cargar la búsqueda de personas." });
  }
}

export async function handleConnections(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config) return unavailable();
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();
  const method = request.method;
  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) return authReply(405, { detail: "Método no permitido." });
  let path: string;
  let body: Record<string, unknown> | undefined;
  if (method === "GET") {
    const query = new URL(request.url).searchParams;
    const view = query.get("vista") ?? "recibidas";
    if (!views.has(view) || [...query.keys()].some(k => k !== "vista") || query.getAll("vista").length > 1) return authReply(422, { detail: "Vista inválida." });
    path = `/conexiones/${view}`;
  } else {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authReply(403, { detail: "Origen no permitido." });
    if (!request.headers.get("content-type")?.startsWith("application/json")) return authReply(422, { detail: "Envía JSON válido." });
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 1024) { await reader.cancel(); return authReply(413, { detail: "Solicitud demasiado grande." }); }
        chunks.push(chunk.value);
      }
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      const input = value as Record<string, unknown>;
      const allowed = method === "POST" ? ["id_receptor_FK"] : method === "PUT" ? ["id", "estado"] : ["id"];
      if (Object.keys(input).some(k => !allowed.includes(k))) throw new Error();
      const id = method === "POST" ? input.id_receptor_FK : input.id;
      if (!Number.isSafeInteger(id) || Number(id) < 1) throw new Error();
      if (method === "PUT" && !["Aceptada", "Rechazada"].includes(String(input.estado))) throw new Error();
      path = method === "POST" ? "/conexiones/" : `/conexiones/${id}`;
      body = method === "POST" ? { id_receptor_FK: id } : method === "PUT" ? { estado: input.estado } : undefined;
    } catch { return authReply(422, { detail: "Revisa los datos de la conexión." }); }
  }
  try {
    const response = await transport(`${config.backend}${path}`, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401) return expired();
    if ([400, 403, 404, 422].includes(response.status)) return authReply(response.status, { detail: "La conexión no está disponible para esta operación." });
    if (!response.ok) return unavailable();
    if (method === "DELETE") return authReply(200, { success: true });
    const normalize = (value: unknown) => {
      if (!value || typeof value !== "object") throw new Error();
      const item = value as Record<string, unknown>;
      if (![item.id_conexion, item.id_solicitante_FK, item.id_receptor_FK].every(id => Number.isSafeInteger(id) && Number(id) > 0) ||
          !["Pendiente", "Aceptada", "Rechazada"].includes(String(item.estado)) || typeof item.fecha_solicitud !== "string") throw new Error();
      return Object.fromEntries(["id_conexion", "id_solicitante_FK", "id_receptor_FK", "estado", "fecha_solicitud"].map(k => [k, item[k]]));
    };
    const value: unknown = await response.json();
    if (method === "GET" && !Array.isArray(value)) throw new Error();
    return authReply(method === "POST" ? 201 : 200, Array.isArray(value) ? value.map(normalize) : normalize(value));
  } catch { return unavailable(); }
}
