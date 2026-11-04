/** Cliente para futuras llamadas desde el navegador al proxy del mismo origen.
 * No valida sesiones. No usar desde Server Components: las cookies no se
 * propagan automáticamente desde una petición de servidor.
 */
export type ApiPath = `/api/${string}` | `/auth/${string}` | `/conexiones/${string}`;
export type ApiRequestOptions = Omit<RequestInit, "credentials" | "cache">;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly payload: unknown) {
    super(errorMessage(status, payload));
    this.name = "ApiError";
  }
}

function errorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item) =>
        item && typeof item.msg === "string" ? [item.msg] : [],
      );
      if (messages.length) return messages.join("; ");
    }
  }
  return `La petición a la API falló (HTTP ${status}).`;
}

export async function apiRequest<T = unknown>(
  path: ApiPath,
  options: ApiRequestOptions = {},
): Promise<T | undefined> {
  // También restringir en ejecución para llamadas desde JavaScript.
  const url = new URL(path, "http://same-origin.invalid");
  if (url.origin !== "http://same-origin.invalid" || path.includes("\\") ||
      !/^\/(api|auth|conexiones)\//.test(path) ||
      !/^\/(api|auth|conexiones)\//.test(url.pathname)) {
    throw new Error("Usa una ruta relativa de /api/, /auth/ o /conexiones/.");
  }

  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  // No fijar Content-Type: FormData necesita que el navegador añada su boundary.
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const text = response.status === 204 ? "" : await response.text();
  const payload: unknown = text && response.headers.get("content-type")?.includes("json")
    ? JSON.parse(text)
    : text || undefined;
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T | undefined;
}
