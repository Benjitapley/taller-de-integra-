"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { AdminData } from "./contracts";
import styles from "./admin.module.css";

export default function AdminPanel() {
  const [page, setPage] = useState(1), [attempt, retry] = useState(0);
  const [data, setData] = useState<AdminData | null>(null);
  const [status, setStatus] = useState(0);
  function load(target = page) {
    setData(null); setStatus(0); setPage(target); retry(v => v + 1);
  }
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`/web-api/admin?pagina=${page}`, { cache: "no-store", credentials: "same-origin", signal: abort.signal })
      .then(async response => {
        const body = response.ok ? await response.json() as AdminData : null;
        if (!abort.signal.aborted) { setData(body); setStatus(response.status); }
      }).catch(() => { if (!abort.signal.aborted) setStatus(503); });
    return () => abort.abort();
  }, [page, attempt]);
  return <section className={styles.panel}>
    <header><h1>Panel administrativo</h1><p>Consulta general de la plataforma.</p></header>
    {!status && <p role="status" aria-busy="true">Cargando panel…</p>}
    {status === 401 && <Card><p role="alert">Tu sesión ha expirado.</p><Link href="/">Iniciar sesión</Link></Card>}
    {status === 403 && <Card><p role="alert">Tu cuenta no tiene acceso administrativo.</p><Link href="/inicio">Volver al inicio</Link></Card>}
    {status >= 400 && ![401, 403].includes(status) && <Card><p role="alert">No se pudo consultar el panel. Intenta nuevamente más tarde.</p><Button onClick={() => load()}>Reintentar</Button></Card>}
    {data && <>
      <dl className={styles.stats}>{Object.entries(data.resumen).map(([label, value]) => <Card key={label}><dt>{label}</dt><dd>{value}</dd></Card>)}</dl>
      <h2>Publicaciones existentes</h2>
      <Button variant="secondary" onClick={() => load()}>Actualizar panel</Button>
      {data.items.length === 0 ? <p role="status">No hay publicaciones en esta página.</p> : <div className={styles.table}><table><caption>Publicaciones · página {page}</caption><thead><tr>{["ID", "Título", "Precio", "Ubicación", "Estado", "Cupos totales"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td>{item.id}</td><th scope="row">{item.titulo || "Sin título"}</th><td>{item.precio === null ? "Sin precio" : new Intl.NumberFormat("es-CL").format(item.precio)}</td><td>{item.ubicacion || "Sin ubicación"}</td><td>{item.estado || "Sin estado"}</td><td>{item.cupos_totales ?? "Sin información"}</td></tr>)}</tbody></table></div>}
      <nav aria-label="Páginas de publicaciones" className={styles.pages}><Button disabled={page === 1} onClick={() => load(page - 1)}>Anterior</Button><span>Página {page}</span><Button disabled={!data.hay_mas || page >= 100000} onClick={() => load(page + 1)}>Siguiente</Button></nav>
    </>}
  </section>;
}
