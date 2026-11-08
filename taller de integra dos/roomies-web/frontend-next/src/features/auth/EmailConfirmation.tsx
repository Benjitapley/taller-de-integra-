"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import AuthField from "./AuthField";
import SubmitButton from "./SubmitButton";
import { submitAuth } from "./client";
import styles from "./auth.module.css";

export default function EmailConfirmation({ error = "" }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
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
    {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
    <p>Ábrelo en el mismo navegador donde creaste tu cuenta. Si el correo no aparece, revisa también la carpeta de spam.</p>
    <p><Link className={styles.headerLink} href="/">Ya confirmé mi correo, iniciar sesión</Link></p>
    <details>
      <summary>¿No recibiste el enlace o necesitas otro?</summary>
      <form onSubmit={resend}>
        <fieldset className={styles.fields} disabled={pending}>
          <legend className={styles.srOnly}>Reenviar confirmación</legend>
          <AuthField label="Correo electrónico" name="correo" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <SubmitButton pending={pending}>Reenviar enlace</SubmitButton>
        </fieldset>
      </form>
      {message && <p role={failed ? "alert" : "status"} className={failed ? styles.errorMessage : styles.formMessage}>{message}</p>}
    </details>
  </section>;
}
