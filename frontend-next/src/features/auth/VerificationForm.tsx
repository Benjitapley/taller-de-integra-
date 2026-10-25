"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { submitAuth } from "./client";
import AuthField from "./AuthField";
import AuthFlowLinks from "./AuthFlowLinks";
import FormMessage from "./FormMessage";
import SubmitButton from "./SubmitButton";
import { useFormReady } from "./useFormReady";
import type { VerificacionRequest } from "./contracts";
import { validateVerification, type VerificationErrors } from "./validation";
import styles from "./auth.module.css";

export default function VerificationForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const ready = useFormReady();
  const [values, setValues] = useState<VerificacionRequest>({ correo: "", codigo: "" });
  const [errors, setErrors] = useState<VerificationErrors>({});
  const [message, setMessage] = useState("");
  function update(name: keyof VerificacionRequest, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
    setMessage("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action = submitter instanceof HTMLButtonElement && submitter.value === "resend" ? "resend" : "verify";
    const nextErrors = validateVerification(values, action);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      setMessage("Revisa los campos indicados. No se enviaron solicitudes ni correos.");
      event.currentTarget.querySelector<HTMLInputElement>(`input[name="${first}"]`)?.focus();
    } else {
      if (Date.now() < retryAt) { setFailed(true); setMessage("Espera antes de volver a intentar."); return; }
      setPending(true);
      const result = await submitAuth(action === "resend" ? "reenviar-codigo" : "verificar", action === "resend" ? { correo: values.correo.trim() } : { ...values, correo: values.correo.trim() });
      setPending(false);
      setFailed(!result.ok);
      setMessage(result.message);
      if (result.retryAfter) setRetryAt(Date.now() + result.retryAfter * 1000);
      if (result.ok && action === "verify") { router.push("/"); router.refresh(); }

    }
  }
  return <form noValidate onSubmit={submit} aria-label="Verificación de correo">
    <fieldset className={styles.fields} disabled={!ready || pending}>
      <legend className={styles.srOnly}>Correo y código de verificación</legend>
      <AuthField label="Correo electrónico" name="correo" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required placeholder="ejemplo@correo.com" value={values.correo} error={errors.correo} onChange={(e) => update("correo", e.target.value)} />
      <AuthField label="Código de verificación" name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" spellCheck={false} required placeholder="000000" hint="Introduce los 6 dígitos del código. Los ceros iniciales se conservan." value={values.codigo} error={errors.codigo} onChange={(e) => update("codigo", e.target.value)} />
      <SubmitButton pending={pending} name="action" value="verify" pendingLabel="Verificando…">Verificar correo</SubmitButton>
      <p className={styles.hint}>¿Necesitas otro código? El reenvío requiere el correo y está sujeto a límites de envío.</p>
      <SubmitButton pending={pending} name="action" value="resend" variant="secondary" pendingLabel="Solicitando código…">Reenviar código</SubmitButton>
    </fieldset>
    <noscript><p>Activa JavaScript para validar el formulario. No se enviará el formulario sin JavaScript.</p></noscript>
    <FormMessage error={failed || Object.values(errors).some(Boolean)}>{message}</FormMessage>
    <AuthFlowLinks screen="verify" />
  </form>;
}
