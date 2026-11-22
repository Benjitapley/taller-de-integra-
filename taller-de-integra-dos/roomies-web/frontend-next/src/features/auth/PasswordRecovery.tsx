"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import AuthField from "./AuthField";
import SubmitButton from "./SubmitButton";
import { submitAuth } from "./client";

export default function PasswordRecovery({ reset = false, initialError = "" }: { reset?: boolean; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [valid, setValid] = useState(!reset);
  const [checking, setChecking] = useState(reset);
  const [message, setMessage] = useState(initialError);
  const [success, setSuccess] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  useEffect(() => {
    if (!reset) return;
    const controller = new AbortController();
    fetch("/web-api/auth/recuperacion-estado", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setValid(response.ok); if (!response.ok) setMessage(response.status === 401 ? "El enlace no es válido o ha expirado. Solicita uno nuevo." : "No se pudo comprobar el enlace. Recarga la página para intentar nuevamente."); } })
      .catch(() => { if (!controller.signal.aborted) setMessage("No se pudo comprobar el enlace. Intenta nuevamente."); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [reset]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !valid) return;
    if (Date.now() < retryAt) { setMessage("Espera antes de volver a solicitar el enlace."); return; }
    if (reset && (password.length < 8 || password.length > 128 || password !== confirmation)) { setMessage("Las contraseñas deben coincidir y tener entre 8 y 128 caracteres."); return; }
    if (!reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage("Introduce un correo válido."); return; }
    setPending(true); setMessage("");
    const result = await submitAuth(reset ? "cambiar-contrasena" : "recuperar", reset ? { contrasena: password, confirmacion: confirmation } : { correo: email.trim() });
    setPending(false); setMessage(result.message); setSuccess(result.ok);
    if (result.retryAfter) setRetryAt(Date.now() + result.retryAfter * 1000);
    if (result.ok && reset) { setPassword(""); setConfirmation(""); }
    if (result.status === 401 && reset) setValid(false);
  }
  return <main style={{ maxWidth: 520, margin: "48px auto", padding: 24 }}><Card>
    <h1>{reset ? "Establecer contraseña nueva" : "Recuperar contraseña"}</h1>
    {checking ? <p role="status">Comprobando enlace…</p> : valid && !(success && reset) && <form onSubmit={submit}>
      <fieldset disabled={pending} style={{ border: 0, display: "grid", gap: 16 }}>
        <legend>{reset ? "Tu contraseña nueva" : "Correo de tu cuenta"}</legend>
        {reset ? <>
          <AuthField label="Contraseña nueva" name="contrasena" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
          <AuthField label="Confirmar contraseña" name="confirmacion" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        </> : <AuthField label="Correo electrónico" name="correo" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />}
        <SubmitButton pending={pending}>{reset ? "Guardar contraseña" : "Enviar enlace de recuperación"}</SubmitButton>
      </fieldset>
    </form>}
    {message && <p role={success ? "status" : "alert"}>{message}</p>}
    {!reset && <p>Si recibes el enlace, ábrelo en el mismo navegador donde lo solicitaste.</p>}
    {reset && !valid && <p><Link href="/recuperar-contrasena">Solicitar un nuevo enlace</Link></p>}
    <p><Link href="/">Volver al inicio de sesión</Link></p>
  </Card></main>;
}
