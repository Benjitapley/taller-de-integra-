"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ReportAccessState from "./ReportAccessState";
import { reportDate, reportTarget, statusLabels, transitions, typeLabels, type AdminReportDetail, type AdminReportPage } from "./reportes";
import styles from "./admin.module.css";

class RequestFailure extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function readResponse<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => null);
  if (!response.ok || !value) throw new RequestFailure(response.ok ? 503 : response.status || 503,
    typeof value?.detail === "string" ? value.detail : "No se pudo completar la solicitud. Intenta nuevamente.");
  return value;
}
const failure = (value: unknown) => value instanceof RequestFailure ? value : new RequestFailure(503, "No se pudo confirmar la operación. Actualiza antes de volver a intentar.");

export function ReportQueue({ initialPage, initialError }: { initialPage?: AdminReportPage; initialError?: number }) {
  const [filters, setFilters] = useState("");
  const [target, setTarget] = useState<{ cursor: string | null; index: number; attempt: number }>({ cursor: null, index: 0, attempt: 0 });
  const [result, setResult] = useState<{ page: AdminReportPage; index: number } | null>(initialPage ? { page: initialPage, index: 0 } : null);
  const [error, setError] = useState<RequestFailure | null>(initialError ? new RequestFailure(initialError, "No se pudo cargar la bandeja. Intenta nuevamente.") : null);
  const [loading, setLoading] = useState(!initialPage && !initialError);
  const busy = useRef(false);
  const cursors = useRef<(string | null)[]>([null]);

  useEffect(() => {
    if (target.attempt === 0 && (initialPage || initialError)) return;
    const controller = new AbortController();
    const query = new URLSearchParams(filters);
    if (target.cursor) query.set("cursor", target.cursor);
    void fetch("/web-api/admin/reportes" + (query.size ? "?" + query : ""), {
      cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    }).then(readResponse<AdminReportPage>).then(page => {
      if (controller.signal.aborted) return;
      cursors.current = [...cursors.current.slice(0, target.index), target.cursor];
      setResult({ page, index: target.index });
      setError(null);
    }).catch(value => {
      if (controller.signal.aborted) return;
      const problem = failure(value);
      if ([401, 403].includes(problem.status)) setResult(null);
      setError(problem);
    }).finally(() => {
      if (!controller.signal.aborted) { busy.current = false; setLoading(false); }
    });
    return () => controller.abort();
  }, [filters, target, initialPage, initialError]);

  function load(cursor: string | null, index: number, nextFilters = filters) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true); setError(null);
    if (nextFilters !== filters) { setResult(null); cursors.current = [null]; }
    setFilters(nextFilters);
    setTarget(previous => ({ cursor, index, attempt: previous.attempt + 1 }));
  }
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams(), form = new FormData(event.currentTarget);
    for (const key of ["estado", "tipo"]) {
      const value = form.get(key);
      if (typeof value === "string" && value) query.set(key, value);
    }
    load(null, 0, query.toString());
  }
  if (error && [401, 403].includes(error.status)) return <ReportAccessState status={error.status} />;
  const page = result?.page;
  return <section className={styles.panel}>
    <Link href="/admin">Volver al panel administrativo</Link><h1>Revisión de reportes</h1>
    <p>Revisa los antecedentes y registra las decisiones. Resolver o descartar un reporte no elimina publicaciones ni retira integrantes.</p>
    <form onSubmit={applyFilters}><fieldset disabled={loading} className={styles.reportFilters}>
      <legend className={styles.srOnly}>Filtrar reportes</legend>
      <label>Estado<select name="estado"><option value="">Todos</option>{Object.entries(statusLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <label>Tipo<select name="tipo"><option value="">Todos</option>{Object.entries(typeLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <Button type="submit">Aplicar filtros</Button>
      <Button variant="secondary" onClick={() => load(null, 0)}>Actualizar bandeja</Button>
    </fieldset></form>
    {loading && <p role="status">Cargando reportes…</p>}
    {error && <Card><p role="alert">{error.message}{page ? " Se conserva la página anterior." : ""}</p>
      <Button variant="secondary" onClick={() => load(target.cursor, target.index)}>Reintentar</Button></Card>}
    {page && (page.items.length === 0 ? <p role="status">{result.index === 0 ? "No hay reportes para estos filtros." : "Llegaste al final de la lista."}</p> : <div className={styles.table}>
      <table><caption>Bandeja de reportes · página {result.index + 1}</caption>
        <thead><tr><th scope="col">Reporte</th><th scope="col">Objetivo</th><th scope="col">Categoría</th><th scope="col">Estado</th><th scope="col">Fecha</th></tr></thead>
        <tbody>{page.items.map(report => <tr key={report.id_reporte}><th scope="row"><Link href={`/admin/reportes/${report.id_reporte}`}>#{report.id_reporte}</Link></th>
          <td>{reportTarget(report)}</td><td>{report.categoria}</td><td>{statusLabels[report.estado]}</td><td><time dateTime={report.fecha}>{reportDate(report.fecha)}</time></td></tr>)}</tbody>
      </table></div>)}
    {result && <nav className={styles.pages} aria-label="Páginas de reportes">
      <Button variant="secondary" disabled={loading || result.index === 0} onClick={() => load(cursors.current[result.index - 1], result.index - 1)}>Anterior</Button>
      <span>Página {result.index + 1}</span>
      <Button variant="secondary" disabled={loading || !page?.siguiente_cursor} onClick={() => load(page!.siguiente_cursor, result.index + 1)}>Siguiente página</Button>
    </nav>}
  </section>;
}

export function ReportDetail({ id, initialReport, initialError }: { id: string; initialReport?: AdminReportDetail; initialError?: number }) {
  const [report, setReport] = useState<AdminReportDetail | null>(initialReport ?? null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<RequestFailure | null>(initialError ? new RequestFailure(initialError, "No se pudo cargar el reporte. Intenta nuevamente.") : null);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const pending = useRef(false);
  const url = `/web-api/admin/reportes/${id}`;

  function deny(problem: RequestFailure) {
    if ([401, 403].includes(problem.status)) { setReport(null); setNote(""); setSelected(""); }
    setError(problem);
  }
  useEffect(() => {
    if (attempt === 0 && (initialReport || initialError)) return;
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(readResponse<AdminReportDetail>).then(data => {
        if (controller.signal.aborted) return;
        setReport(data); setError(null); setBlocked(false);
        setSelected(previous => transitions[data.estado].some(state => state === previous) ? previous : "");
      }).catch(value => {
        if (controller.signal.aborted) return;
        const problem = failure(value);
        if ([401, 403].includes(problem.status)) { setReport(null); setNote(""); setSelected(""); }
        setError(problem);
      }).finally(() => { if (!controller.signal.aborted) { pending.current = false; setBusy(false); } });
    return () => controller.abort();
  }, [url, attempt, initialReport, initialError]);

  function reload() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); setSaved(false);
    setAttempt(value => value + 1);
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || blocked || !report) return;
    if (!transitions[report.estado].some(state => state === selected) || Array.from(note.trim()).length > 1000 || note.includes("\0")) {
      setError(new RequestFailure(422, "Selecciona una transición válida y una nota de hasta 1000 caracteres.")); return;
    }
    pending.current = true; setBusy(true); setError(null); setSaved(false);
    try {
      const response = await fetch(url, { method: "PATCH", credentials: "same-origin", signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify({ estado: selected, nota_interna: note.trim() || null }) });
      setReport(await readResponse<AdminReportDetail>(response));
      setNote(""); setSelected(""); setSaved(true);
    } catch (value) {
      const problem = failure(value);
      if (problem.status === 409 || problem.status >= 500) setBlocked(true);
      deny(problem);
    } finally { pending.current = false; setBusy(false); }
  }
  if (error && [401, 403].includes(error.status)) return <ReportAccessState status={error.status} />;
  return <section className={styles.panel}>
    <Link href="/admin/reportes">Volver a la bandeja</Link><h1>Reporte #{id}</h1>
    {(!report && !error || busy) && <p role="status">{report ? "Procesando solicitud…" : "Cargando reporte…"}</p>}
    {error && <Card><p role="alert">{error.message}</p>
      {blocked && <p>Tu nota se conserva. Actualiza el reporte y consulta la bitácora antes de tomar otra decisión.</p>}
      <Button variant="secondary" disabled={busy} onClick={reload}>Actualizar reporte</Button></Card>}
    {report && <>
      <Card><h2>{report.categoria}</h2><p>{reportTarget(report)} · {statusLabels[report.estado]}</p>
        <p>Denunciante #{report.id_denunciante} · <time dateTime={report.fecha}>{reportDate(report.fecha)}</time></p><p className={styles.reportText}>{report.descripcion}</p></Card>
      {transitions[report.estado].length > 0 ? <Card><h2>Cambiar estado</h2>
        <form onSubmit={review}><fieldset disabled={busy || blocked} className={styles.reviewForm}>
          <label>Nuevo estado<select value={selected} onChange={event => setSelected(event.target.value)} required>
            <option value="" disabled>Seleccionar estado</option>{transitions[report.estado].map(state => <option key={state} value={state}>{statusLabels[state]}</option>)}
          </select></label>
          <label>Nota interna (opcional)<textarea rows={4} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label>
          <Button type="submit">{busy ? "Guardando…" : "Guardar cambio"}</Button>
        </fieldset></form><p>La nota es privada para administración y no aparece en Mis reportes.</p></Card>
        : <Card><p>Este reporte está cerrado y no admite más transiciones.</p>{note && <label>Nota que estabas editando<textarea readOnly value={note} /></label>}</Card>}
      {saved && <p role="status">Se guardó el cambio y quedó registrado en la bitácora.</p>}
      <Button variant="secondary" disabled={busy} onClick={reload}>Consultar estado actualizado</Button>
      <Card><h2>Bitácora</h2>{report.historial.length === 0 ? <p>Aún no se han registrado actuaciones.</p> : <ol>
        {report.historial.map(entry => <li key={entry.id_actuacion}><p><strong>{statusLabels[entry.estado_anterior]} → {statusLabels[entry.estado_nuevo]}</strong></p>
          <p>Administrador #{entry.id_administrador} · <time dateTime={entry.fecha}>{reportDate(entry.fecha)}</time></p>{entry.nota_interna && <p className={styles.reportText}>{entry.nota_interna}</p>}</li>)}
      </ol>}</Card>
    </>}
  </section>;
}
