import "server-only";
import { authConfig, authReply, limitedJson, readToken, sessionCookie, type Transport, type WebAuthConfig } from "../auth/gateway";

const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && Array.from(value).length <= max && !value.includes("\0");

/** Cookie authentication and CSRF protection for private convivencia operations. */
export async function handleConvivencia(request: Request, path: string, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!/^\/api\/(?:arriendos\/[1-9][0-9]*\/(?:expulsiones|tareas)|tareas\/[1-9][0-9]*(?:\/estado)?)$/.test(path)) return authReply(404, { detail: "Ruta no disponible." });
  const withdrawal = path.endsWith("/expulsiones");
  const taskItem = path.startsWith("/api/tareas/");
  const methods = withdrawal ? ["POST"] : taskItem ? ["PATCH"] : ["GET", "POST"];
  if (!methods.includes(request.method)) return authReply(405, { detail: "Método no permitido." }, { Allow: methods.join(", ") });
  if (!config) return authReply(503, { detail: "Convivencia no está disponible." });
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  const invalid = () => authReply(422, { detail: "Revisa los datos y la confirmación." });
  const query = new URL(request.url).searchParams;
  let body: Record<string, unknown> | undefined;
  if (request.method !== "GET") {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authReply(403, { detail: "Origen de solicitud no permitido." });
    if (query.size || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return invalid();
    try {
      body = await limitedJson(request);
      const fields = withdrawal ? ["id_usuario", "motivo", "confirmo"] : path.endsWith("/estado") ? ["estado"] : taskItem ? ["id_asignado"] : ["titulo", "descripcion", "id_asignado"];
      if (Object.keys(body).some(key => !fields.includes(key))) return invalid();
      if (withdrawal && (!id(body.id_usuario) || !text(body.motivo, 500) || body.confirmo !== true)) return invalid();
      if (!withdrawal && path.endsWith("/estado") && body.estado !== "Completada") return invalid();
      if (!withdrawal && !path.endsWith("/estado")) {
        if (taskItem && !("id_asignado" in body)) return invalid();
        if (body.id_asignado !== undefined && body.id_asignado !== null && !id(body.id_asignado)) return invalid();
        if (!taskItem && (!text(body.titulo, 120) || (body.descripcion != null && (typeof body.descripcion !== "string" || Array.from(body.descripcion).length > 1000)))) return invalid();
      }
    } catch { return invalid(); }
  } else {
    if ([...query.keys()].some(key => !["cursor", "limite", "estado", "id_asignado"].includes(key) || query.getAll(key).length !== 1)) return invalid();
    if (query.has("cursor") && !/^[A-Za-z0-9_-]{1,2048}$/.test(query.get("cursor")!)) return invalid();
    if (query.has("limite") && (!/^[0-9]+$/.test(query.get("limite")!) || Number(query.get("limite")) < 1 || Number(query.get("limite")) > 100)) return invalid();
    if (query.has("estado") && !["Pendiente", "Completada"].includes(query.get("estado")!)) return invalid();
    if (query.has("id_asignado") && !id(Number(query.get("id_asignado")))) return invalid();
  }
  try {
    const response = await transport(config.backend + path + (query.size ? "?" + query.toString() : ""), {
      method: request.method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const status = [401, 403, 404, 409, 422].includes(response.status) ? response.status : 503;
      const detail = status === 403 ? "No tienes permiso para esta operación." : status === 404 ? "El arriendo o la tarea ya no están disponibles." : status === 422 ? "Revisa los datos y la confirmación." : status === 409 ? "El estado cambió. Actualiza antes de reintentar." : "No pudimos confirmar la operación. Actualiza o reintenta.";
      return authReply(status, { detail }, status === 401 ? { "Set-Cookie": sessionCookie(config) } : {});
    }
    const data = await response.json();
    if (withdrawal) {
      if (!data || data.id_arriendo !== Number(path.split("/")[3]) || data.id_usuario_retirado !== body!.id_usuario ||
          !["Activo", "Finalizado"].includes(data.estado) || typeof data.sincronizacion_pendiente !== "boolean" ||
          ![data.ocupacion, data.cupos_totales].every(Number.isSafeInteger) || data.ocupacion < 0 || data.cupos_totales < 1 || data.cupos_totales < data.ocupacion) throw new Error();
      return authReply(200, { id_arriendo: data.id_arriendo, id_usuario_retirado: data.id_usuario_retirado,
        estado: data.estado, integrantes_activos: data.ocupacion, cupos_disponibles: data.cupos_totales - data.ocupacion,
        sincronizacion_pendiente: data.sincronizacion_pendiente });
    }
    const task = (value: Record<string, unknown>) => {
      if (!value || !id(value.id_tarea) || !id(value.id_arriendo) || !id(value.id_creador) || !text(value.titulo, 120) ||
          !(value.id_asignado === null || id(value.id_asignado)) || !["Pendiente", "Completada"].includes(String(value.estado)) ||
          !(value.descripcion === null || typeof value.descripcion === "string" && value.descripcion.length <= 1000) ||
          typeof value.fecha_creacion !== "string" || !Number.isFinite(Date.parse(value.fecha_creacion))) throw new Error();
      if (taskItem ? value.id_tarea !== Number(path.split('/')[3]) : value.id_arriendo !== Number(path.split('/')[3])) throw new Error();
      return Object.fromEntries(["id_tarea", "id_arriendo", "id_creador", "titulo", "descripcion", "id_asignado", "estado", "fecha_creacion"].map(key => [key, value[key]]));
    };
    if (request.method === "GET") {
      if (!Array.isArray(data?.items) || data.items.length > Number(query.get("limite") ?? 20) || !(data.siguiente_cursor === null || typeof data.siguiente_cursor === "string" && /^[A-Za-z0-9_-]{1,2048}$/.test(data.siguiente_cursor))) throw new Error();
      return authReply(200, { items: data.items.map(task), siguiente_cursor: data.siguiente_cursor });
    }
    return authReply(request.method === "POST" ? 201 : 200, task(data));
  } catch { return authReply(503, { detail: "No pudimos confirmar la operación. Actualiza o reintenta." }); }
}
