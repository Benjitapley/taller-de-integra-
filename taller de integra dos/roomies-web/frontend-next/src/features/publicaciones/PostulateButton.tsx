"use client";
import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function PostulateButton({ id }: { id: number }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function apply() {
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/web-api/postulaciones", { method: "POST", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify({ publicacion: id }) });
      const result = await response.json();
      setMessage(response.ok ? "Postulación enviada." : result.detail || "No se pudo postular.");
    } catch { setMessage("No se pudo confirmar el envío. Revisa Mis postulaciones antes de repetirlo."); }
    finally { setPending(false); }
  }
  return <div><Button disabled={pending} onClick={() => void apply()}>{pending ? "Enviando…" : "Postular individualmente"}</Button>
    {message && <p role="status">{message}</p>}<p><Link href="/mis-postulaciones">Mis postulaciones</Link></p></div>;
}
