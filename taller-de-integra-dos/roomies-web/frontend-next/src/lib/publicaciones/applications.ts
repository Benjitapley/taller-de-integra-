import "server-only";
import { authConfig, authReply, readToken, sessionCookie, type WebAuthConfig, type Transport } from "../auth/gateway";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function handleApplications(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch, applicationId?: string) {
  if (!config) return authReply(503, { detail: "Postulaciones no disponibles." });
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();
  let path: string;
  let body: unknown;
  let target: number | undefined;
  let key: string | null = null;
  let expectedPublication: number | undefined;
  let expectedLimit = 20;
  if (request.method === "GET") {
    const query = new URL(request.url).searchParams;
    if (applicationId !== undefined) {
      if (!/^[1-9]\d{0,9}$/.test(applicationId) || query.size) return authReply(422, { detail: "Consulta inválida." });
      target = Number(applicationId);
      path = `/api/postulaciones/${applicationId}`;
    } else {
      const id = query.get("publicacion");
      if ([...query.keys()].some(key => !["publicacion","cursor","limite","estado"].includes(key)) || query.getAll("publicacion").length > 1 || (id !== null && !/^[1-9]\d{0,9}$/.test(id))) return authReply(422, { detail: "Consulta inválida." });
      const pagination = new URLSearchParams({limite: query.get("limite") ?? "20"});
      for (const field of ["cursor","estado"] as const) if (query.has(field)) pagination.set(field, query.get(field)!);
      if (["cursor","limite","estado"].some(field => query.getAll(field).length > 1) ||
          !/^(?:[1-9]\d?|100)$/.test(pagination.get("limite")!) ||
          (query.has("cursor") && !/^[A-Za-z0-9_-]{1,1024}$/.test(query.get("cursor")!)) ||
          (query.has("estado") && !["Pendiente","Preseleccionada","Aceptada","Rechazada","Cancelada"].includes(query.get("estado")!))) return authReply(422,{detail:"Paginación inválida."});
      expectedPublication = id === null ? undefined : Number(id);
      expectedLimit = Number(pagination.get("limite"));
      path = (id ? `/api/publicaciones/${id}/postulantes` : "/api/postulaciones/mias") + `?${pagination}`;
    }
  } else if (["POST", "PATCH"].includes(request.method)) {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authReply(403, { detail: "Origen no permitido." });
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return authReply(422, { detail: "Envía JSON válido." });
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        length += item.value.length;
        if (length > 4096) { await reader.cancel(); return authReply(413, { detail: "Solicitud demasiado grande." }); }
        chunks.push(item.value);
      }
      const value = JSON.parse(Buffer.concat(chunks).toString());
      const allowed = request.method === "POST" ? ["publicacion","retiro"] : ["id", "estado", "motivo"];
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error();
      const id = request.method === "POST" ? (value.publicacion ?? value.retiro) : value.id;
      if (!Number.isSafeInteger(id) || id < 1) throw new Error();
      if (request.method === "POST") {
        if (Object.keys(value).length !== 1) throw new Error();
        if (value.retiro !== undefined) { path = `/api/postulaciones/${id}/retiro`; target = id; }
        else path = `/api/publicaciones/${id}/postulaciones`;
      }
      else {
        if (!["Preseleccionada", "Aceptada", "Rechazada"].includes(value.estado) ||
            (value.motivo !== undefined && (typeof value.motivo !== "string" || value.motivo.length > 1000))) throw new Error();
        path = `/api/postulaciones/${id}/estado`;
        target = id;
        key = request.headers.get("idempotency-key");
        if ((value.estado === "Aceptada" && !key) || (key !== null && !uuid.test(key))) throw new Error();
        body = { estado: value.estado, ...(value.motivo === undefined ? {} : { motivo: value.motivo }) };
      }
    } catch { return authReply(422, { detail: "Datos de postulación inválidos." }); }
  } else return authReply(405, { detail: "Método no permitido." });
  try {
    const response = await transport(`${config.backend}${path}`, { method: request.method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(key ? { "Idempotency-Key": key } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401) return expired();
    if ([403, 404, 409, 422].includes(response.status)) return authReply(response.status, { detail: response.status === 409 ? "La postulación ya existe o su estado no permite esta acción." : "No tienes acceso a esta acción o los datos no son válidos." });
    if (!response.ok) throw new Error();
    const value: unknown = await response.json();
    const normalize = (item: unknown) => {
      if (!item || typeof item !== "object") throw new Error();
      const row = item as Record<string, unknown>;
      if (![row.id_postulacion, row.id_publicacion, row.id_usuario].every(id => Number.isSafeInteger(id) && Number(id) > 0) || !["Pendiente", "Preseleccionada", "Aceptada", "Rechazada", "Cancelada"].includes(String(row.estado))) throw new Error();
      if (target !== undefined && row.id_postulacion !== target) throw new Error();
      if (expectedPublication !== undefined && row.id_publicacion !== expectedPublication) throw new Error();
      if (row.id_arriendo !== undefined && row.id_arriendo !== null && (!Number.isSafeInteger(row.id_arriendo) || Number(row.id_arriendo) < 1)) throw new Error();
      if (row.incorporacion_pendiente !== undefined && typeof row.incorporacion_pendiente !== "boolean") throw new Error();
      if (row.estado === "Aceptada" && (!row.id_arriendo || row.incorporacion_pendiente !== false || response.status === 202)) throw new Error();
      if (row.incorporacion_pendiente === true && !row.operacion) throw new Error();
      const result = Object.fromEntries(["id_postulacion", "id_publicacion", "id_usuario", "titulo", "estado", "motivo", "fecha_postulacion", "id_arriendo", "incorporacion_pendiente"].filter(key => key in row).map(key => [key, row[key]]));
      if (row.operacion !== undefined && row.operacion !== null) {
        if (typeof row.operacion !== "object" || Array.isArray(row.operacion)) throw new Error();
        const operation = row.operacion as Record<string, unknown>;
        if (typeof operation.id_operacion !== "string" || !uuid.test(operation.id_operacion) || !["Pendiente", "Confirmada", "Rechazada"].includes(String(operation.estado)) ||
            (operation.codigo_error !== undefined && (typeof operation.codigo_error !== "string" || operation.codigo_error.length > 100))) throw new Error();
        if ((operation.estado === "Confirmada" && row.estado !== "Aceptada") || (row.estado === "Aceptada" && operation.estado !== "Confirmada")) throw new Error();
        if (operation.estado === "Pendiente" && (row.estado !== "Preseleccionada" || row.incorporacion_pendiente !== true || row.id_arriendo != null)) throw new Error();
        if (operation.estado === "Rechazada" && (row.incorporacion_pendiente !== false || row.id_arriendo != null)) throw new Error();
        result.operacion = { id_operacion: operation.id_operacion, estado: operation.estado, ...(operation.codigo_error === undefined ? {} : { codigo_error: operation.codigo_error }) };
      }
      return result;
    };
    if (request.method === "GET" && applicationId === undefined) {
      const page = value as {items:unknown[];siguiente_cursor:unknown};
      if (!page || !Array.isArray(page.items) || page.items.length > expectedLimit || !(page.siguiente_cursor === null || typeof page.siguiente_cursor === "string" && /^[A-Za-z0-9_-]{1,1024}$/.test(page.siguiente_cursor))) throw new Error();
      const items = page.items.map(normalize);
      if (new Set(items.map(item => item.id_postulacion)).size !== items.length) throw new Error();
      return authReply(200,{items,siguiente_cursor:page.siguiente_cursor});
    }
    if (Array.isArray(value)) throw new Error();
    return authReply(response.status === 202 ? 202 : request.method === "POST" && target === undefined ? 201 : 200, normalize(value));
  } catch { return authReply(503, { detail: "No se confirmó la operación. Actualiza tus postulaciones antes de repetirla." }); }
}
