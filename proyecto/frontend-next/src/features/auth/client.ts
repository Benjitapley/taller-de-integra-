export async function submitAuth(action: string, body: object) {
  try {
    const response = await fetch(`/web-api/auth/${action}`, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json();
    const retry = response.headers.get("retry-after");
    return { ok: response.ok && data.success === true, status: response.status,
      message: String(data.detail ?? data.message ?? (response.ok && data.success === true ? "Sesión iniciada." : "No se confirmó la operación.")),
      retryAfter: response.status === 429 && retry && /^\d{1,5}$/.test(retry) ? Number(retry) : 0 };
  } catch {
    return { ok: false, status: 503, message: "No se pudo contactar al servicio. No se confirmó la operación; comprueba tu cuenta antes de repetirla.", retryAfter: 0 };
  }
}
