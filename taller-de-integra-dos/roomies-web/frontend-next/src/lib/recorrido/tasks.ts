import "server-only";
import { authConfig, authReply, limitedJson, readToken, type Transport, type WebAuthConfig } from "../auth/gateway";
export async function handleTasks(request: Request, id: string, operation: "rental" | "assign" | "complete", config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config) return authReply(503, { detail: "Tareas no disponibles." });
  if (!/^[1-9][0-9]{0,9}$/.test(id)) return authReply(422, { detail: "Identificador inválido." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." });
  if (!(operation === "rental" ? ["GET", "POST"] : ["PATCH"]).includes(request.method)) return authReply(405, {});
  const query = new URL(request.url).searchParams;
  let path = operation === "rental" ? `/api/arriendos/${id}/tareas` : `/api/tareas/${id}${operation === "complete" ? "/estado" : ""}`;
  let body: Record<string, unknown> | undefined;
  if (request.method === "GET") {
    if ([...query.keys()].some(key => key !== "cursor") || query.getAll("cursor").length > 1 || (query.has("cursor") && !/^[A-Za-z0-9_-]{1,128}$/.test(query.get("cursor")!))) return authReply(422, {});
    if (query.size) path += "?" + query;
  } else {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authReply(403, { detail: "Origen no permitido." });
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return authReply(422, {});
    try { body = await limitedJson(request); } catch { return authReply(422, {}); }
    const fields = operation === "rental" ? ["titulo", "descripcion", "id_asignado"] : operation === "assign" ? ["id_asignado"] : ["estado"];
    if (Object.keys(body).some(key => !fields.includes(key))) return authReply(422, {});
  }
  try {
    const response = await transport(config.backend + path, { method: request.method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) return authReply([401,403,404,409,422].includes(response.status) ? response.status : 503, { detail: "No se pudo completar la operación de tareas." });
    const task = (row: Record<string, unknown>) => {
      if (!row || ![row.id_tarea,row.id_arriendo,row.id_creador].every(value => Number.isSafeInteger(value) && Number(value)>0) || typeof row.titulo !== "string" || !["Pendiente","Completada"].includes(String(row.estado)) || (row.id_asignado !== null && (!Number.isSafeInteger(row.id_asignado) || Number(row.id_asignado)<1))) throw new Error();
      return { id_tarea: row.id_tarea, id_arriendo: row.id_arriendo, id_creador: row.id_creador, titulo: row.titulo, descripcion: row.descripcion,
        estado: row.estado, id_asignado: row.id_asignado, fecha_creacion: row.fecha_creacion };
    };
    const data = await response.json();
    if (request.method !== "GET") return authReply(response.status, task(data));
    if (!Array.isArray(data.items) || data.items.length > 20 || !(data.siguiente_cursor === null || typeof data.siguiente_cursor === "string")) throw new Error();
    return authReply(200, { items: data.items.map(task), siguiente_cursor: data.siguiente_cursor });
  } catch { return authReply(503, { detail: "No se pudo confirmar la operación de tareas." }); }
}
