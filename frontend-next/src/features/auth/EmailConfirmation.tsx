"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import AuthField from "./AuthField";
import SubmitButton from "./SubmitButton";
import { submitAuth } from "./client";

export default function EmailConfirmation({ error = "" }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(error);
  const [failed, setFailed] = useState(Boolean(error));
  const [retryAt, setRetryAt] = useState(0);
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFailed(true); setMessage("Introduce un correo válido."); return; }
    if (Date.now() < retryAt) { setFailed(true); setMessage("Espera antes de volver a solicitar el enlace."); return; }
    setPending(true);
    const result = await submitAuth("reenviar-codigo", { correo: email.trim() });
    setPending(false); setFailed(!result.ok); setMessage(result.message);
    if (result.retryAfter) setRetryAt(Date.now()+result.retryAfter*1000);
  }
  return <section>
    <p>Revisa tu correo y abre el enlace de confirmación en el mismo navegador donde creaste tu cuenta. No necesitas introducir un código numérico.</p>
    <form onSubmit={resend}><fieldset disabled={pending} style={{ border: 0, display: "grid", gap: 16 }}>
      <legend>¿Necesitas otro enlace?</legend>
      <AuthField label="Correo electrónico" name="correo" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      <SubmitButton pending={pending}>Reenviar enlace</SubmitButton>
    </fieldset></form>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    <p><Link href="/">Volver al inicio de sesión</Link></p>
  </section>;
}
