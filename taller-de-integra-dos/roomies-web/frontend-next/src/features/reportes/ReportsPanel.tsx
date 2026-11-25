"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { reportCategories, type Report, type ReportTarget } from "./contracts";
import { useCursorList } from "../lists/useCursorList";
import ListProgress from "../lists/ListProgress";
import styles from "./reportes.module.css";

const labels = { Pendiente: "Pendiente", En_Revision: "En revisión", Resuelto: "Resuelto", Descartado: "Descartado" };
const reportId = (item: Report) => item.id_reporte;

export default function ReportsPanel({ target }: { target?: ReportTarget }) {
  const history = useCursorList<Report>("/web-api/reportes", reportId);
  const { loading: reading } = history;
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sent, setSent] = useState<Report | null>(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [confirm, setConfirm] = useState(false);
  const operation = useRef<{ body: string; key: string } | null>(null);
  const submitting = useRef(false);
  const submission = useRef<AbortController | null>(null);
  const targetText = target && ("id_usuario_reportado" in target ? `Usuario #${target.id_usuario_reportado}` : `Publicación #${target.id_publicacion_reportada}`);

  useEffect(() => () => submission.current?.abort(), []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || submitting.current) return;
    const categoria = category.trim(), descripcion = description.trim();
    if (!confirm || !reportCategories.some(value => value === categoria) || !descripcion || Array.from(descripcion).length > 1000 || descripcion.includes("\0")) {
      setSendError("Selecciona una categoría, escribe una descripción y confirma el envío.");
      return;
    }
    const body = JSON.stringify({ ...target, categoria, descripcion });
    if (operation.current?.body !== body) operation.current = { body, key: crypto.randomUUID() };
    submitting.current = true;
    const controller = new AbortController();
    submission.current = controller;
    setSending(true);
    setSendError("");
    try {
      const response = await fetch("/web-api/reportes", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1", "Idempotency-Key": operation.current.key }, body,
      });
      const data = await response.json();
      if (!response.ok) { setSendError(data.detail || "No se pudo enviar el reporte. Conservamos lo que escribiste."); return; }
      if (response.status !== 201 || !Number.isSafeInteger(data.id_reporte) || data.id_reporte <= 0 ||
          data.categoria !== categoria || data.descripcion !== descripcion ||
          data.id_usuario_reportado !== ("id_usuario_reportado" in target ? target.id_usuario_reportado : null) ||
          data.id_publicacion_reportada !== ("id_publicacion_reportada" in target ? target.id_publicacion_reportada : null)) throw new Error();
      setSent(data);
      await history.load();
    } catch {
      if (!controller.signal.aborted) setSendError("No pudimos confirmar el envío. Consulta tus reportes o reintenta sin crear un reporte duplicado.");
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setSending(false);
    }
  }

  return <div className={styles.layout}>
    {target && <Card className={styles.panel}>
      <h2>Enviar reporte</h2>
      {sent ? <div>
        <p role="status">Recibimos el reporte #{sent.id_reporte}. Estado: {labels[sent.estado]}.</p>
        <Button variant="secondary" onClick={() => { setSent(null); setCategory(""); setDescription(""); setConfirm(false); operation.current = null; }}>Enviar otro reporte</Button>
      </div> : <form onSubmit={send}>
        <p>{targetText}</p>
        {"id_usuario_reportado" in target && <p>Puedes reportar a personas con quienes tuviste una conexión aceptada o compartiste arriendo. El servidor verifica el permiso.</p>}
        <fieldset className={styles.form} disabled={sending} aria-busy={sending}>
          <label htmlFor="report-category">Categoría</label>
          <select id="report-category" name="categoria" value={category} onChange={event => setCategory(event.target.value)} required>
            <option value="">Selecciona una categoría</option>
            {reportCategories.map(value => <option key={value}>{value}</option>)}
          </select>
          <label htmlFor="report-description">Descripción</label>
          <textarea id="report-description" name="descripcion" rows={5} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} aria-describedby="report-help" required />
          <small id="report-help">{Array.from(description).length}/1000 caracteres. Reportar no elimina ni oculta la publicación.</small>
          <label className={styles.confirm}><input type="checkbox" checked={confirm} onChange={event => setConfirm(event.target.checked)} required />Confirmo que quiero enviar este reporte.</label>
          <Button type="submit">{sending ? "Enviando…" : "Enviar reporte"}</Button>
        </fieldset>
        {sendError && <p role="alert">{sendError}</p>}
      </form>}
    </Card>}
    <Card className={styles.panel}>
      <h2>Mis reportes</h2>
      <Button variant="secondary" disabled={reading} onClick={() => void history.load()}>Actualizar estados</Button>
      {history.loaded && !reading && !history.error && !history.items.length && <p>Aún no tienes reportes. Puedes iniciar uno desde <Link href="/inicio">Inicio</Link> o desde el detalle de una publicación.</p>}
      {history.items.length > 0 && <ul className={styles.history}>
        {history.items.map(report => <li key={report.id_reporte}>
          <strong>Reporte #{report.id_reporte} · {report.categoria}</strong>
          <p>{report.tipo === "Usuario" ? `Usuario #${report.id_usuario_reportado}` : `Publicación #${report.id_publicacion_reportada}`} · {labels[report.estado]}</p>
          <p className={styles.description}>{report.descripcion}</p>
          <time dateTime={report.fecha}>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(report.fecha))}</time>
        </li>)}
      </ul>}
      <ListProgress {...history} count={history.items.length} retry={() => void history.retryLoad()} more={() => void history.load(history.cursor)} />
    </Card>
  </div>;
}
