"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import styles from "./auth.module.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { label: string; error?: string; hint?: string };

export default function AuthField({ label, error, hint, type = "text", ...props }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.inputWrap}>
      <input {...props} id={id} type={password && visible ? "text" : type} aria-invalid={error ? true : undefined} aria-describedby={description} />
      {password && <button className={styles.toggle} type="button" aria-controls={id} aria-pressed={visible} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible(!visible)}>{visible ? "Ocultar" : "Mostrar"}</button>}
    </div>
    {hint && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
    {error && <p id={`${id}-error`} className={styles.fieldError}>{error}</p>}
  </div>;
}
