"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { ApplicationRequestError, applicationRequest, mutateApplication } from "./application-client";
import type { Application, CursorPage } from "./application-contract";

export default function PostulateButton({ id }: { id: number }) {
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const key = useRef<string>(null);
  async function apply() {
    if (busy.current || submitted) return;
    busy.current = true;
    setPending(true); setMessage("");
    try {
      key.current ??= crypto.randomUUID();
      await mutateApplication<Application>("POST", { publicacion: id }, key.current);
      setSubmitted(true);
      setMessage("Postulación enviada.");
    } catch (error) {
      if (error instanceof ApplicationRequestError && error.status !== 409 && error.status < 500) {
        setMessage(error.message);
        return;
      }
      const list = await applicationRequest<CursorPage<Application>>("/web-api/postulaciones").catch(() => null);
      if (list?.items.some(item => item.id_publicacion === id && ["Pendiente", "Preseleccionada", "Aceptada"].includes(item.estado))) {
        setSubmitted(true);
        setMessage("La postulación aparece en Mis postulaciones.");
      } else {
        setMessage(error instanceof ApplicationRequestError && error.status === 409
          ? error.message : "No se confirmó el envío. Revisa Mis postulaciones antes de repetirlo.");
      }
    } finally { busy.current = false; setPending(false); }
  }
  return <div><Button disabled={pending || submitted} onClick={() => void apply()}>{pending ? "Enviando…" : "Postular al arriendo"}</Button>
    {message && <p role="status">{message}</p>}<p><Link href="/mis-postulaciones">Mis postulaciones</Link></p></div>;
}
