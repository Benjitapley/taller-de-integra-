import "server-only";
import { authConfig, authReply, readToken, sessionCookie, type WebAuthConfig, type Transport } from "../auth/gateway";

export async function handleApplications(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config) return authReply(503, { detail: "Postulaciones no disponibles." });
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();
  let path: string;
  let body: unknown;
  if (request.method === "GET") {
    const query = new URL(request.url).searchParams;
    const id = query.get("publicacion");
    if ([...query.keys()].some(key => key !== "publicacion") || query.getAll("publicacion").length > 1 || (id !== null && !/^[1-9]\d{0,9}$/.test(id))) return authReply(422, { detail: "Consulta inválida." });
    path = id ? `/api/publicaciones/${id}/postulantes` : "/api/postulaciones/mias";
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
      const allowed = request.method === "POST" ? ["publicacion"] : ["id", "estado", "motivo"];
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error();
      const id = request.method === "POST" ? value.publicacion : value.id;
      if (!Number.isSafeInteger(id) || id < 1) throw new Error();
      if (request.method === "POST") path = `/api/publicaciones/${id}/postulaciones`;
      else {
        if (!["Preseleccionada", "Aceptada", "Rechazada", "Cancelada"].includes(value.estado) ||
            (value.motivo !== undefined && (typeof value.motivo !== "string" || value.motivo.length > 1000))) throw new Error();
        path = `/api/postulaciones/${id}/estado`;
        body = { estado: value.estado, ...(value.motivo === undefined ? {} : { motivo: value.motivo }) };
      }
    } catch { return authReply(422, { detail: "Datos de postulación inválidos." }); }
  } else return authReply(405, { detail: "Método no permitido." });
  try {
    const response = await transport(`${config.backend}${path}`, { method: request.method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401) return expired();
    if ([403, 404, 409, 422].includes(response.status)) return authReply(response.status, { detail: response.status === 409 ? "La postulación ya existe o su estado no permite esta acción." : "No tienes acceso a esta acción o los datos no son válidos." });
    if (!response.ok) throw new Error();
    const value: unknown = await response.json();
    const normalize = (item: unknown) => {
      if (!item || typeof item !== "object") throw new Error();
      const row = item as Record<string, unknown>;
      if (![row.id_postulacion, row.id_publicacion, row.id_usuario].every(id => Number.isSafeInteger(id) && Number(id) > 0) || !["Pendiente", "Preseleccionada", "Aceptada", "Rechazada", "Cancelada"].includes(String(row.estado))) throw new Error();
      return Object.fromEntries(["id_postulacion", "id_publicacion", "id_usuario", "titulo", "estado", "motivo", "fecha_postulacion", "incorporacion_pendiente"].filter(key => key in row).map(key => [key, row[key]]));
    };
    if (request.method === "GET" && !Array.isArray(value)) throw new Error();
    return authReply(request.method === "POST" ? 201 : 200, Array.isArray(value) ? value.map(normalize) : normalize(value));
  } catch { return authReply(503, { detail: "No se confirmó la operación. Actualiza tus postulaciones antes de repetirla." }); }
}
