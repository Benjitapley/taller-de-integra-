import "server-only";
import { authConfig, authReply, readToken, sessionCookie, type WebAuthConfig, type Transport } from "../auth/gateway";
import { applicationStates, type Application, type CursorPage } from "../../features/publicaciones/application-contract";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid response");
  return value as Record<string, unknown>;
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function routeId(value: string | null): value is string {
  return value !== null && /^[1-9]\d{0,15}$/.test(value) && positiveId(Number(value));
}

function application(value: unknown): Application {
  const row = record(value);
  const state = applicationStates.find((entry) => entry === row.estado);
  if (!state || !positiveId(row.id_postulacion) || !positiveId(row.id_publicacion) || !positiveId(row.id_usuario)) {
    throw new Error("Invalid application");
  }
  return {
    id_postulacion: row.id_postulacion, id_publicacion: row.id_publicacion, id_usuario: row.id_usuario, estado: state,
    ...(typeof row.titulo === "string" ? { titulo: row.titulo } : {}),
    ...(typeof row.nombre_postulante === "string" ? { nombre_postulante: row.nombre_postulante } : {}),
    ...(typeof row.estado_publicacion === "string" ? { estado_publicacion: row.estado_publicacion } : {}),
    ...(typeof row.fecha_postulacion === "string" ? { fecha_postulacion: row.fecha_postulacion } : {}),
    ...(typeof row.fecha_estado === "string" ? { fecha_estado: row.fecha_estado } : {}),
    ...(row.motivo === null || typeof row.motivo === "string" ? { motivo: row.motivo } : {}),
    ...(state === "Aceptada" && (row.id_arriendo === null || positiveId(row.id_arriendo)) ? { id_arriendo: row.id_arriendo } : {}),
    ...(typeof row.incorporacion_pendiente === "boolean" ? { incorporacion_pendiente: row.incorporacion_pendiente } : {}),
  };
}

function cursorIsValid(value: string) {
  return value.length > 0 && value.length <= 1024 && !/[\x00-\x20\x7f]/.test(value);
}

function pageQuery(query: URLSearchParams) {
  const result = new URLSearchParams();
  const cursor = query.get("cursor");
  const limit = query.get("limite");
  if (cursor !== null) {
    if (query.getAll("cursor").length !== 1 || !cursorIsValid(cursor)) throw new Error("Invalid cursor");
    result.set("cursor", cursor);
  }
  if (limit !== null) {
    if (query.getAll("limite").length !== 1 || !/^(?:[1-9]\d?|100)$/.test(limit)) throw new Error("Invalid limit");
    result.set("limite", limit);
  }
  return result.size ? `?${result}` : "";
}

function page<T>(value: unknown, normalize: (item: unknown) => T): CursorPage<T> {
  // The previous API returned an array. Both versions are normalized here.
  if (Array.isArray(value)) return { items: value.map(normalize), siguiente_cursor: null };
  const input = record(value);
  if (!Array.isArray(input.items) || !(input.siguiente_cursor === null ||
    typeof input.siguiente_cursor === "string" && cursorIsValid(input.siguiente_cursor))) throw new Error("Invalid page");
  return { items: input.items.map(normalize), siguiente_cursor: input.siguiente_cursor };
}

function sessionExpired(config: WebAuthConfig) {
  return authReply(401, { detail: "Inicia sesión nuevamente." }, { "Set-Cookie": sessionCookie(config) });
}

function unavailable(message = "No se pudieron consultar las postulaciones.") {
  return authReply(503, { detail: message });
}

function upstreamError(response: Response, config: WebAuthConfig) {
  const messages: Record<number, string> = {
    403: "No tienes permiso para esta acción.",
    404: "El recurso solicitado no está disponible.",
    409: "El estado, la disponibilidad de cupos o la pertenencia del postulante impiden esta acción.",
    422: "Los datos o el cursor de consulta no son válidos.",
  };
  if (response.status === 401) return sessionExpired(config);
  const message = messages[response.status];
  if (message) return authReply(response.status, { detail: message });
  return null;
}

async function readMutation(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.length;
    if (length > 4096) { await reader.cancel(); return null; }
    chunks.push(item.value);
  }
  return record(JSON.parse(Buffer.concat(chunks).toString()));
}

export async function handleApplications(request: Request, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  if (!config) return unavailable();
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return sessionExpired(config);
  let path: string;
  let expectedId: number | undefined;
  let expectedPublication: number | undefined;
  let body: unknown;
  let listing = false;
  let operationKey: string | null = null;
  let targetState: string | undefined;
  if (request.method === "GET") {
    const query = new URL(request.url).searchParams;
    const publication = query.get("publicacion");
    const id = query.get("id");
    if ([...query.keys()].some(key => !["publicacion", "id", "limite", "cursor"].includes(key)) ||
      query.getAll("publicacion").length > 1 || query.getAll("id").length > 1 ||
      (publication !== null && !routeId(publication)) ||
      (id !== null && (!routeId(id) || publication !== null || query.size !== 1))) {
      return authReply(422, { detail: "Consulta inválida." });
    }
    try {
      listing = id === null;
      expectedId = id === null ? undefined : Number(id);
      expectedPublication = publication === null ? undefined : Number(publication);
      path = id ? `/api/postulaciones/${id}`
        : (publication ? `/api/publicaciones/${publication}/postulantes` : "/api/postulaciones/mias") + pageQuery(query);
    } catch { return authReply(422, { detail: "Paginación inválida." }); }
  } else if (["POST", "PATCH"].includes(request.method)) {
    if (request.headers.get("origin") !== config.origin || request.headers.get("x-haycupo-csrf") !== "1" ||
        (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return authReply(403, { detail: "Origen no permitido." });
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return authReply(422, { detail: "Envía JSON válido." });
    operationKey = request.headers.get("Idempotency-Key");
    if (operationKey !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationKey)) return authReply(422, { detail: "Clave de operación inválida." });
    try {
      const value = await readMutation(request);
      if (!value) return authReply(413, { detail: "Solicitud demasiado grande." });
      if (request.method === "POST") {
        if (Object.keys(value).length !== 1) throw new Error();
        if (positiveId(value.publicacion)) {
          expectedPublication = value.publicacion;
          path = `/api/publicaciones/${value.publicacion}/postulaciones`;
        } else if (positiveId(value.retiro)) {
          expectedId = value.retiro;
          targetState = "Cancelada";
          path = `/api/postulaciones/${value.retiro}/retiro`;
        } else throw new Error();
      } else {
        if (!positiveId(value.id) || Object.keys(value).some(key => !["id", "estado", "motivo"].includes(key)) ||
          typeof value.estado !== "string" || !["Preseleccionada", "Aceptada", "Rechazada"].includes(value.estado) ||
          (value.motivo !== undefined && (typeof value.motivo !== "string" || value.motivo.length > 1000 || value.motivo.includes("\0")))) throw new Error();
        expectedId = value.id;
        targetState = value.estado;
        path = `/api/postulaciones/${value.id}/estado`;
        body = { estado: value.estado, ...(value.motivo === undefined ? {} : { motivo: value.motivo }) };
      }
    } catch { return authReply(422, { detail: "Datos de postulación inválidos." }); }
  } else return authReply(405, { detail: "Método no permitido." });
  try {
    const response = await transport(`${config.backend}${path}`, {
      method: request.method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json", Authorization: `Bearer ${token}`,
        ...(operationKey ? { "Idempotency-Key": operationKey } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) return upstreamError(response, config) ?? unavailable(request.method === "GET" ? undefined : "No se confirmó la operación. Consulta el estado antes de repetirla.");
    if (response.status === 202 && targetState === "Aceptada") return authReply(202, { incorporacion_pendiente: true });
    const value: unknown = await response.json();
    if (listing) {
      const result = page(value, application);
      if (expectedPublication !== undefined && result.items.some(item => item.id_publicacion !== expectedPublication)) throw new Error();
      return authReply(200, result);
    }
    const result = application(value);
    if ((expectedId !== undefined && result.id_postulacion !== expectedId) ||
      (expectedPublication !== undefined && result.id_publicacion !== expectedPublication) ||
      (targetState !== undefined && result.estado !== targetState && !(targetState === "Aceptada" && result.incorporacion_pendiente))) throw new Error();
    return authReply(request.method === "POST" && targetState === undefined ? 201 : 200, result);
  } catch {
    return unavailable(request.method === "GET" ? undefined : "No se confirmó la operación. Consulta el estado antes de repetirla.");
  }
}

export async function handleRental(request: Request, rental: string, config: WebAuthConfig | null = authConfig(), transport: Transport = fetch) {
  const failure = () => unavailable("No se pudo consultar el arriendo. Intenta nuevamente.");
  if (!config) return failure();
  const token = readToken(request.headers.get("cookie"), config);
  if (!token) return sessionExpired(config);
  if (request.method !== "GET") return authReply(405, { detail: "Método no permitido." });
  const query = new URL(request.url).searchParams;
  if (rental === "mio" ? query.size > 0 : !routeId(rental) || [...query.keys()].some(key => !["cursor", "limite"].includes(key))) {
    return authReply(422, { detail: "Consulta inválida." });
  }
  let suffix: string;
  try { suffix = pageQuery(query); } catch { return authReply(422, { detail: "Paginación inválida." }); }
  try {
    const path = rental === "mio" ? "/api/arriendos/mio" : `/api/arriendos/${rental}/integrantes${suffix}`;
    const response = await transport(`${config.backend}${path}`, {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 404 && rental === "mio") {
        const body = await response.json().catch(() => null);
        if (body?.detail === "Ruta no disponible.") return failure();
      }
      return upstreamError(response, config) ?? failure();
    }
    const data: unknown = await response.json();
    if (rental !== "mio") {
      return authReply(200, page(data, item => {
        const member = record(item);
        if (!positiveId(member.id_usuario)) throw new Error("Invalid member");
        return {
          id_usuario: member.id_usuario,
          ...(typeof member.nombre === "string" ? { nombre: member.nombre } : {}),
          activo: typeof member.activo === "boolean" ? member.activo : member.fecha_salida === null ? true : typeof member.fecha_salida === "string" ? false : null,
        };
      }));
    }
    const current = record(data);
    if (!positiveId(current.id_arriendo) || !positiveId(current.id_publicacion) || current.estado !== "Activo") throw new Error("Invalid rental");
    return authReply(200, {
      id_arriendo: current.id_arriendo, id_publicacion: current.id_publicacion,
      ...(typeof current.titulo === "string" ? { titulo: current.titulo } : {}),
    });
  } catch { return failure(); }
}
