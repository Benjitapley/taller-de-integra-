function sessionChange(phase: "start" | "complete") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("roomies:session-change", { detail: phase }));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("roomies-session");
    channel.postMessage(phase);
    channel.close();
  }
}

export async function submitAuth(action: string, body: object) {
  const changesSession = action === "login" || action === "logout";
  if (changesSession) sessionChange("start");
  try {
    const response = await fetch(`/web-api/auth/${action}`, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(action === "cambiar-contrasena" ? 45_000 : 15_000),
    });
    const data = await response.json();
    const retry = response.headers.get("retry-after");
    return { ok: response.ok && data.success === true, status: response.status,
      message: String(data.detail ?? data.message ?? (response.ok && data.success === true ? "Sesión iniciada." : "No se confirmó la operación.")),
      retryAfter: response.status === 429 && retry && /^\d{1,5}$/.test(retry) ? Number(retry) : 0 };
  } catch {
    return { ok: false, status: 503, message: "No se pudo contactar al servicio. No se confirmó la operación; comprueba tu cuenta antes de repetirla.", retryAfter: 0 };
  } finally {
    if (changesSession) sessionChange("complete");
  }
}
