"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { reportDate, reportTarget, statusLabels, transitions, typeLabels, type AdminReportDetail, type AdminReportPage } from "./reportes";
import styles from "./admin.module.css";

async function readResponse<T>(response: Response): Promise<T> {
  const value = await response.json();
  if (!response.ok) throw new Error(value.detail || "No se pudo completar la solicitud.");
  return value;
}

export function ReportQueue() {
  const [filters, setFilters] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<AdminReportPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(filters);
    if (cursor) query.set("cursor", cursor);
    const url = "/web-api/admin/reportes" + (query.size ? "?" + query : "");
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(readResponse<AdminReportPage>).then(data => {
        if (!controller.signal.aborted) setPage(data);
      }).catch(failure => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [filters, cursor, attempt]);

  function load(next: string | null, nextFilters = filters) {
    setPage(null);
    setError("");
    setFilters(nextFilters);
    setCursor(next);
    setAttempt(value => value + 1);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    const form = new FormData(event.currentTarget);
    for (const field of ["estado", "tipo"]) {
      const value = form.get(field);
      if (typeof value === "string" && value) query.set(field, value);
    }
    load(null, query.toString());
  }

  return <section className={styles.panel}>
    <Link href="/admin">Volver al panel administrativo</Link>
    <h1>Revisión de reportes</h1>
    <form className={styles.reportFilters} onSubmit={applyFilters}>
      <label>Estado<select name="estado"><option value="">Todos</option>
        {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Tipo<select name="tipo"><option value="">Todos</option>
        {Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <Button type="submit">Aplicar filtros</Button>
    </form>
    {!page && !error && <p role="status">Cargando reportes…</p>}
    {error && <Card><p role="alert">{error}</p><Button variant="secondary" onClick={() => load(cursor)}>Reintentar</Button></Card>}
    {page && (page.items.length === 0 ? <p>No hay reportes para estos filtros.</p> : <div className={styles.table}>
      <table>
        <caption>Bandeja de reportes</caption>
        <thead><tr><th scope="col">Reporte</th><th scope="col">Objetivo</th><th scope="col">Categoría</th><th scope="col">Estado</th><th scope="col">Fecha</th></tr></thead>
        <tbody>{page.items.map(report => <tr key={report.id_reporte}>
          <th scope="row"><Link href={`/admin/reportes/${report.id_reporte}`}>#{report.id_reporte}</Link></th>
          <td>{reportTarget(report)}</td><td>{report.categoria}</td><td>{statusLabels[report.estado]}</td>
          <td><time dateTime={report.fecha}>{reportDate(report.fecha)}</time></td>
        </tr>)}</tbody>
      </table>
    </div>)}
    {page && (cursor || page.siguiente_cursor) && <nav className={styles.pages} aria-label="Páginas de reportes">
      {cursor && <Button variant="secondary" onClick={() => load(null)}>Primera página</Button>}
      {page.siguiente_cursor && <Button variant="secondary" onClick={() => load(page.siguiente_cursor)}>Siguiente página</Button>}
    </nav>}
  </section>;
}

export function ReportDetail({ id }: { id: string }) {
  const [report, setReport] = useState<AdminReportDetail | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = `/web-api/admin/reportes/${id}`;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(readResponse<AdminReportDetail>).then(data => {
        if (!controller.signal.aborted) setReport(data);
      }).catch(failure => {
        if (!controller.signal.aborted) setLoadError(failure.message);
      });
    return () => controller.abort();
  }, [url, attempt]);

  function reload() {
    setLoadError("");
    setSaveError("");
    setSaved(false);
    setReport(null);
    setAttempt(value => value + 1);
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setSaveError("");
    setSaved(false);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
        body: JSON.stringify({ estado: form.get("estado"), nota_interna: form.get("nota_interna") }),
      });
      setReport(await readResponse<AdminReportDetail>(response));
      setSaved(true);
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : "No se pudo confirmar el cambio.");
    } finally { setBusy(false); }
  }

  return <section className={styles.panel}>
    <Link href="/admin/reportes">Volver a la bandeja</Link>
    <h1>Reporte #{id}</h1>
    {!report && !loadError && <p role="status">Cargando reporte…</p>}
    {loadError && <Card><p role="alert">{loadError}</p><Button variant="secondary" onClick={reload}>Reintentar</Button></Card>}
    {report && <>
      <Card>
        <h2>{report.categoria}</h2>
        <p>{reportTarget(report)} · {statusLabels[report.estado]}</p>
        <p>Denunciante #{report.id_denunciante} · <time dateTime={report.fecha}>{reportDate(report.fecha)}</time></p>
        <p className={styles.reportText}>{report.descripcion}</p>
      </Card>
      {transitions[report.estado].length > 0 && <Card>
        <h2>Cambiar estado</h2>
        <form key={report.estado} onSubmit={review}>
          <fieldset disabled={busy} className={styles.reviewForm}>
            <label>Nuevo estado<select name="estado" defaultValue="" required>
              <option value="" disabled>Seleccionar estado</option>
              {transitions[report.estado].map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </select></label>
            <label>Nota interna (opcional)<textarea name="nota_interna" rows={4} maxLength={1000} /></label>
            <Button type="submit">{busy ? "Guardando…" : "Guardar cambio"}</Button>
          </fieldset>
        </form>
      </Card>}
      {saved && <p role="status">Se guardó el cambio y quedó registrado en la bitácora.</p>}
      {saveError && <Card><p role="alert">{saveError}</p><Button variant="secondary" onClick={reload}>Actualizar reporte</Button></Card>}
      <Card>
        <h2>Bitácora</h2>
        {report.historial.length === 0 ? <p>Aún no se han registrado actuaciones.</p> : <ol>
          {report.historial.map(entry => <li key={entry.id_actuacion}>
            <p><strong>{statusLabels[entry.estado_anterior]} → {statusLabels[entry.estado_nuevo]}</strong></p>
            <p>Administrador #{entry.id_administrador} · <time dateTime={entry.fecha}>{reportDate(entry.fecha)}</time></p>
            {entry.nota_interna && <p className={styles.reportText}>{entry.nota_interna}</p>}
          </li>)}
        </ol>}
      </Card>
    </>}
  </section>;
}
