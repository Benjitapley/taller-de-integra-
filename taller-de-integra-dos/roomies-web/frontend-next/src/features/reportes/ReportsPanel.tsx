"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { Report, ReportPage, ReportTarget } from "./contracts";
import styles from "./reportes.module.css";

const labels = { Pendiente: "Pendiente", En_Revision: "En revisión", Resuelto: "Resuelto", Descartado: "Descartado" };

async function fetchHistory(cursor: string | undefined, signal: AbortSignal): Promise<ReportPage> {
  const query = cursor ? "?" + new URLSearchParams({ cursor }) : "";
  const response = await fetch("/web-api/reportes" + query, { cache: "no-store", signal });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "No pudimos cargar tus reportes.");
  }
  return response.json();
}

export default function ReportsPanel({ target }: { target?: ReportTarget }) {
  const [page, setPage] = useState<ReportPage | null>(null);
  const [reading, setReading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sent, setSent] = useState<Report | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  const targetText = target && ("id_usuario_reportado" in target
    ? `Usuario #${target.id_usuario_reportado}` : `Publicación #${target.id_publicacion_reportada}`);

  const loadHistory = useCallback((cursor?: string) => {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    const { signal } = controller;
    return fetchHistory(cursor, signal).then(next => {
      if (!signal.aborted) setPage(current => cursor && current ? { ...next, items: [...current.items, ...next.items] } : next);
    }).catch(error => {
      if (!signal.aborted) setHistoryError(error instanceof Error ? error.message : "No pudimos cargar tus reportes.");
    }).finally(() => {
      if (!signal.aborted) setReading(false);
    });
  }, []);

  useEffect(() => {
    void loadHistory();
    return () => historyRequest.current?.abort();
  }, [loadHistory]);

  function refreshHistory(cursor?: string) {
    setReading(true);
    setHistoryError("");
    return loadHistory(cursor);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || sending) return;
    const form = new FormData(event.currentTarget);
    const categoria = String(form.get("categoria") ?? "").trim();
    const descripcion = String(form.get("descripcion") ?? "").trim();
    if (!categoria || !descripcion) {
      setSendError("Completa la categoría y la descripción.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const response = await fetch("/web-api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
        body: JSON.stringify({ ...target, categoria, descripcion }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSendError(data.detail || "No se pudo enviar el reporte.");
        return;
      }
      setSent(data);
      await refreshHistory();
    } catch {
      setSendError("No pudimos confirmar el envío. Actualiza tus reportes antes de volver a intentarlo.");
    } finally {
      setSending(false);
    }
  }

  return <div className={styles.layout}>
    {target && <Card>
      <h2>Enviar reporte</h2>
      {sent ? <p role="status">Recibimos el reporte #{sent.id_reporte}.</p> : <form onSubmit={send}>
        <p>{targetText}</p>
        {target && "id_usuario_reportado" in target && <p>Puedes reportar a personas con quienes tuviste una conexión aceptada o compartiste arriendo.</p>}
        <fieldset className={styles.form} disabled={sending} aria-busy={sending}>
          <label htmlFor="report-category">Categoría</label>
          <input id="report-category" name="categoria" maxLength={80} required />
          <label htmlFor="report-description">Descripción</label>
          <textarea id="report-description" name="descripcion" rows={5} maxLength={1000} required />
          <Button type="submit">{sending ? "Enviando…" : "Enviar reporte"}</Button>
        </fieldset>
        {sendError && <p role="alert">{sendError}</p>}
      </form>}
    </Card>}
    <Card>
      <h2>Historial</h2>
      {reading && <p role="status">Cargando tus reportes…</p>}
      {historyError && <p role="alert">{historyError}</p>}
      {historyError && <Button variant="secondary" disabled={reading} onClick={() => void refreshHistory()}>Actualizar</Button>}
      {!reading && !historyError && !page?.items.length && <p>Aún no tienes reportes. Puedes iniciar uno desde <Link href="/inicio">Inicio</Link>.</p>}
      {page && page.items.length > 0 && <ul className={styles.history}>
        {page.items.map(report => <li key={report.id_reporte}>
          <strong>{report.categoria}</strong>
          <p>{report.tipo === "Usuario" ? `Usuario #${report.id_usuario_reportado}` : `Publicación #${report.id_publicacion_reportada}`} · {labels[report.estado]}</p>
          <p className={styles.description}>{report.descripcion}</p>
          <time dateTime={report.fecha}>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(report.fecha))}</time>
        </li>)}
      </ul>}
      {page?.siguiente_cursor && !historyError && <Button variant="secondary" disabled={reading} onClick={() => void refreshHistory(page.siguiente_cursor!)}>Ver más</Button>}
    </Card>
  </div>;
}
