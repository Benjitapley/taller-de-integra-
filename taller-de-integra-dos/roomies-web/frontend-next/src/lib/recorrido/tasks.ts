import "server-only";
import { authConfig, authReply, limitedJson, readToken, sessionCookie, type Transport, type WebAuthConfig } from "../auth/gateway";

const idOk = (s: string) => /^[1-9][0-9]{0,18}$/.test(s) && Number.isSafeInteger(Number(s));
const cursorOk = (s: string | null) => s === null || /^[A-Za-z0-9_-]{1,128}$/.test(s);
const positive = (x: unknown) => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
const invalid = () => authReply(422, { detail: "Datos de tarea inválidos." });
const unavailable = () => authReply(503, { detail: "No se pudo confirmar la operación. Actualiza la lista antes de reintentar." });

function task(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  const t = value as Record<string, unknown>;
  if (!positive(t.id_tarea) || !positive(t.id_arriendo) || !positive(t.id_creador) ||
      !(t.id_asignado === null || positive(t.id_asignado)) ||
      typeof t.titulo !== "string" || !t.titulo.trim() || t.titulo.length > 120 ||
      !(t.descripcion === null || typeof t.descripcion === "string" && t.descripcion.length <= 1000) ||
      !["Pendiente", "Completada"].includes(String(t.estado)) ||
      typeof t.fecha_creacion !== "string" || !Number.isFinite(Date.parse(t.fecha_creacion))) throw new Error();
  return { id_tarea: t.id_tarea, id_arriendo: t.id_arriendo, titulo: t.titulo,
    descripcion: t.descripcion, estado: t.estado, id_creador: t.id_creador,
    id_asignado: t.id_asignado, fecha_creacion: t.fecha_creacion };
}

async function request(req: Request, path: string, method: string, body: unknown,
                       config: WebAuthConfig | null, transport: Transport) {
  if (!config) return unavailable();
  const token = readToken(req.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." });
  if (method !== "GET" && (req.headers.get("origin") !== config.origin ||
      req.headers.get("x-haycupo-csrf") !== "1" ||
      (req.headers.has("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin")))
    return authReply(403, { detail: "Solicitud no permitida." });
  try {
    const response = await transport(`${config.backend}${path}`, {
      method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
    if ([403, 404, 409, 422].includes(response.status)) {
      const detail = await response.json().catch(() => ({}));
      return authReply(response.status, { detail: typeof detail.detail === "string" ? detail.detail : "Operación rechazada." });
    }
    if (!response.ok) return unavailable();
    const data = await response.json();
    if (path.includes("/integrantes")) {
      if (!Array.isArray(data?.items) || data.items.length > 20 || !cursorOk(data.siguiente_cursor)) throw new Error();
      return authReply(200, { items: data.items.map((m: Record<string, unknown>) => {
        if (!m || !positive(m.id_usuario) || m.activo !== true) throw new Error();
        return { id_usuario: m.id_usuario, nombre: typeof m.nombre === "string" ? m.nombre.slice(0, 200) : null,
          activo: true };
      }), siguiente_cursor: data.siguiente_cursor });
    }
    if (method !== "GET") return authReply(method === "POST" ? 201 : 200, task(data));
    if (!Array.isArray(data?.items) || data.items.length > 100 || !cursorOk(data.siguiente_cursor) ||
        !positive(data.id_usuario_actual)) throw new Error();
    return authReply(200, { items: data.items.map(task), siguiente_cursor: data.siguiente_cursor,
      id_usuario_actual: data.id_usuario_actual });
  } catch { return unavailable(); }
}

export async function handleTasks(req: Request, rental: string,
  config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!idOk(rental)) return invalid();
  if (!["GET", "POST"].includes(req.method)) return authReply(405, { detail: "Método no permitido." }, { Allow: "GET, POST" });
  const path = `/api/arriendos/${rental}/tareas`;
  if (req.method === "POST") {
    if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return invalid();
    let body: Record<string, unknown>;
    try { body = await limitedJson(req); } catch { return invalid(); }
    if (Object.keys(body).some(k => !["titulo", "descripcion", "id_asignado"].includes(k)) ||
        typeof body.titulo !== "string" || !body.titulo.trim() || body.titulo.length > 120 ||
        typeof body.descripcion !== "string" || body.descripcion.length > 1000 ||
        !(body.id_asignado === null || positive(body.id_asignado))) return invalid();
    return request(req, path, "POST", body, config, transport);
  }
  const q = new URL(req.url).searchParams;
  if ([...q.keys()].some(k => !["estado", "cursor", "limite"].includes(k) || q.getAll(k).length !== 1)) return invalid();
  const estado = q.get("estado") ?? "Pendiente", cursor = q.get("cursor"), limite = q.get("limite") ?? "20";
  if (!["Pendiente", "Completada"].includes(estado) || !cursorOk(cursor) || !/^(?:[1-9][0-9]?|100)$/.test(limite)) return invalid();
  const query = new URLSearchParams({ estado, limite });
  if (cursor) query.set("cursor", cursor);
  return request(req, `${path}?${query}`, "GET", undefined, config, transport);
}

export async function handleTaskMembers(req: Request, rental: string,
  config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (req.method !== "GET") return authReply(405, { detail: "Método no permitido." }, { Allow: "GET" });
  if (!idOk(rental)) return invalid();
  const q = new URL(req.url).searchParams;
  if ([...q.keys()].some(k => k !== "cursor" || q.getAll(k).length !== 1) || !cursorOk(q.get("cursor"))) return invalid();
  const query = new URLSearchParams({ activos: "true" });
  if (q.get("cursor")) query.set("cursor", q.get("cursor")!);
  return request(req, `/api/arriendos/${rental}/integrantes?${query}`, "GET", undefined, config, transport);
}

export async function handleTaskPatch(req: Request, id: string, state: boolean,
  config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (req.method !== "PATCH") return authReply(405, { detail: "Método no permitido." }, { Allow: "PATCH" });
  if (!idOk(id) || req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return invalid();
  let body: Record<string, unknown>;
  try { body = await limitedJson(req); } catch { return invalid(); }
  if (state ? Object.keys(body).length !== 1 || body.estado !== "Completada" :
      Object.keys(body).length !== 1 || !positive(body.id_asignado)) return invalid();
  return request(req, `/api/tareas/${id}${state ? "/estado" : ""}`, "PATCH", body, config, transport);
}
