"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitAuth } from "./client";
import { routes } from "@/config/navigation";
import AuthField from "./AuthField";
import FormMessage from "./FormMessage";
import SubmitButton from "./SubmitButton";
import AuthFlowLinks from "./AuthFlowLinks";
import { useFormReady } from "./useFormReady";
import { validateAuth, type AuthErrors, type AuthFieldName, type AuthMode, type AuthValues } from "./validation";
import styles from "./auth.module.css";

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const register = mode === "register";
  const ready = useFormReady();
  const [values, setValues] = useState<AuthValues>({ nombre: "", correo: "", contrasena: "", fecha_nacimiento: "" });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [submitted, setSubmitted] = useState(false);
  function update(name: AuthFieldName, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
    setSubmitted(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextErrors = validateAuth(mode, values);
    setErrors(nextErrors);
    setSubmitted(true);
    const first = Object.keys(nextErrors)[0];
    if (first) { event.currentTarget.querySelector<HTMLInputElement>(`input[name="${first}"]`)?.focus(); return; }
    setPending(true);
    const result = await submitAuth(register ? "registro" : "login", register ? { ...values, correo: values.correo.trim() } : { correo: values.correo.trim(), contrasena: values.contrasena });
    setPending(false);
    setFailed(!result.ok);
    setMessage(result.message);
    setValues((previous) => ({ ...previous, contrasena: "" }));
    if (result.ok) { router.push(register ? routes.verify : routes.home); router.refresh(); }

  }
  const invalid = Object.values(errors).some(Boolean);
  return <form noValidate onSubmit={submit} aria-label={register ? "Registro de usuarios" : "Inicio de sesión"}>
    {/* Sin JS no se permite un envío HTML accidental de credenciales. */}
    <fieldset className={styles.fields} disabled={!ready || pending}>
      <legend className={styles.srOnly}>{register ? "Datos de registro" : "Credenciales de acceso"}</legend>
      {register && <AuthField label="Nombre completo" name="nombre" autoComplete="name" placeholder="Tu nombre completo" required value={values.nombre} onChange={(e) => update("nombre", e.target.value)} error={errors.nombre} />}
      <AuthField label="Correo electrónico" name="correo" type="email" autoComplete={register ? "email" : "username"} inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="ejemplo@correo.com" required value={values.correo} onChange={(e) => update("correo", e.target.value)} error={errors.correo} />
      {register && <AuthField label="Fecha de nacimiento" name="fecha_nacimiento" type="date" autoComplete="bday" required hint="Debes tener al menos 18 años." value={values.fecha_nacimiento} onChange={(e) => update("fecha_nacimiento", e.target.value)} error={errors.fecha_nacimiento} />}
      <AuthField label="Contraseña" name="contrasena" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 6 : undefined} hint={register ? "Mínimo 6 caracteres." : undefined} value={values.contrasena} onChange={(e) => update("contrasena", e.target.value)} error={errors.contrasena} />
      <SubmitButton pending={pending}>{register ? "Crear cuenta" : "Iniciar sesión"}<span aria-hidden="true">→</span></SubmitButton>
    </fieldset>
    <noscript><p>Activa JavaScript para validar el formulario. El envío seguro requiere JavaScript.</p></noscript>
    <FormMessage error={submitted && (invalid || failed)}>{submitted ? invalid ? "Revisa los campos indicados." : message : null}</FormMessage>
    <p className={styles.switch}>{register ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"} <Link href={register ? routes.access : routes.register}>{register ? "Iniciar sesión" : "Crear cuenta nueva"}</Link></p>
    <AuthFlowLinks screen={mode} />
  </form>;
}
