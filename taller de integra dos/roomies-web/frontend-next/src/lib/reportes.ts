import "server-only";
import { authConfig, authReply, limitedJson, readToken, sessionCookie, upstream, type Transport, type WebAuthConfig } from "./auth/gateway";
import type { Report } from "../features/reportes/contracts";

export function reportsEnabled(config: WebAuthConfig | null = authConfig()) {
  return config?.provider === "supabase" && process.env.WEB_REPORTES_ENABLED === "true";
}

const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const validText = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && Array.from(value.trim()).length <= limit && !value.includes("\0");
const responseFields = ["id_reporte", "tipo", "id_usuario_reportado", "id_publicacion_reportada", "categoria", "descripcion", "estado", "fecha"] as const;

export function publicReport(value: unknown): Report {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  const report = value as Record<string, unknown>;
  const person = positiveId(report.id_usuario_reportado) && report.id_publicacion_reportada === null && report.tipo === "Usuario";
  const listing = positiveId(report.id_publicacion_reportada) && report.id_usuario_reportado === null && report.tipo === "Publicacion";
  if (!positiveId(report.id_reporte) || !(person || listing) ||
      !validText(report.categoria, 80) || !validText(report.descripcion, 1000) ||
      typeof report.estado !== "string" || !["Pendiente", "En_Revision", "Resuelto", "Descartado"].includes(report.estado) ||
      typeof report.fecha !== "string" || !Number.isFinite(Date.parse(report.fecha))) throw new Error();
  return Object.fromEntries(responseFields.map(key => [key, report[key]])) as Report;
}

const unavailable = () => authReply(503, { detail: "No pudimos confirmar la operación. Revisa tus reportes antes de volver a enviarlo." });
const invalid = () => authReply(422, { detail: "Revisa los datos del reporte." });

export async function handleReports(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config || !reportsEnabled(config)) return authReply(404, { detail: "Reportes no está habilitado." });
  const token = readToken(request.headers.get("cookie"), config);
  const expired = () => authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
  if (!token) return expired();

  const sending = request.method === "POST";
  const query = new URL(request.url).searchParams;
  let path: string;
  let body: Record<string, unknown> | undefined;
  if (sending) {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
      return authReply(403, { detail: "Origen de solicitud no permitido." });
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || query.size) return invalid();
    try {
      const data = await limitedJson(request);
      const { categoria, descripcion, id_usuario_reportado: person, id_publicacion_reportada: listing } = data;
      const allowed = ["categoria", "descripcion", "id_usuario_reportado", "id_publicacion_reportada"];
      if (Object.keys(data).some(key => !allowed.includes(key)) || !validText(categoria, 80) || !validText(descripcion, 1000)) return invalid();
      if ((person != null && !positiveId(person)) || (listing != null && !positiveId(listing)) || (person == null) === (listing == null)) return invalid();
      body = { categoria: categoria.trim(), descripcion: descripcion.trim(), ...(person == null ? { id_publicacion_reportada: listing } : { id_usuario_reportado: person }) };
    } catch { return invalid(); }
    path = "/api/reportes";
  } else if (request.method === "GET") {
    if ([...query.keys()].some(key => key !== "cursor" || query.getAll(key).length !== 1)) return invalid();
    const cursor = query.get("cursor");
    if (cursor !== null && !/^[A-Za-z0-9_.-]{1,512}$/.test(cursor)) return invalid();
    path = "/api/reportes/mios" + (cursor === null ? "" : "?" + query.toString());
  } else {
    return authReply(405, { detail: "Método no permitido." }, { Allow: "GET, POST" });
  }

  try {
    const response = await upstream(config, path, token, body, transport);
    if (response.status === 401) return expired();
    if (response.status === 403) return authReply(403, { detail: sending
      ? "No puedes reportar ese objetivo. Confirma tu correo y comprueba que la publicación sea ajena o que hayas tenido una conexión aceptada o convivencia con esa persona."
      : "Tu cuenta no puede consultar estos reportes." });
    if (response.status === 404) return authReply(404, { detail: sending ? "El objetivo del reporte no está disponible." : "No se encontraron reportes para esta sesión." });
    if (response.status === 422) return invalid();
    if (response.status === 429) return authReply(429, { detail: "Espera unos minutos antes de volver a intentarlo." });
    if (response.status !== (sending ? 201 : 200)) return unavailable();
    const data = await response.json();
    if (sending) return authReply(201, publicReport(data));
    if (!Array.isArray(data?.items) || data.items.length > 20 ||
        (data.siguiente_cursor !== null && (typeof data.siguiente_cursor !== "string" || !/^[A-Za-z0-9_.-]{1,512}$/.test(data.siguiente_cursor)))) return unavailable();
    return authReply(200, { items: data.items.map(publicReport), siguiente_cursor: data.siguiente_cursor });
  } catch {
    return unavailable();
  }
}
