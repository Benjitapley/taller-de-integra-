"use client";

export class ApplicationRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function applicationRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(path, {
    ...options, cache: "no-store", credentials: "same-origin",
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new ApplicationRequestError(response.status, value?.detail ?? "No se pudo completar la solicitud.");
  if (!value || typeof value !== "object") throw new Error("Respuesta inesperada.");
  return value as T;
}

export function mutateApplication<T>(method: "POST" | "PATCH", body: Record<string, unknown>, key: string) {
  return applicationRequest<T>("/web-api/postulaciones", {
    method, body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1", "Idempotency-Key": key },
  });
}

// Per-tab recovery for a single acceptance. No account data or credentials are stored.
export function acceptanceKey(id: number, create: () => string) {
  const entry = `roomies:aceptar-postulacion:${id}`;
  try {
    const existing = sessionStorage.getItem(entry);
    if (existing) return existing;
    const key = create();
    sessionStorage.setItem(entry, key);
    return key;
  } catch {
    return create();
  }
}

export function finishAcceptance(id: number) {
  try { sessionStorage.removeItem(`roomies:aceptar-postulacion:${id}`); }
  catch { /* Storage may be disabled. */ }
}
