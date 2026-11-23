"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";

type Member = { id_usuario: number; nombre: string | null };
type Page = { items: Member[]; siguiente_cursor: string | null };

export default function ReportMembers({ rentalId }: { rentalId: number }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const retry = useRef<string | undefined>(undefined);
  useEffect(() => () => request.current?.abort(), []);

  async function load(cursor?: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    retry.current = cursor;
    setLoading(true); setError("");
    try {
      const query = cursor ? "?" + new URLSearchParams({ cursor }) : "";
      const response = await fetch(`/web-api/arriendos/${rentalId}/integrantes${query}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No pudimos consultar los integrantes.");
      if (!controller.signal.aborted) setPage(current => ({ ...data, items: [...new Map(
        (cursor && current ? [...current.items, ...data.items] : data.items).map((item: Member) => [item.id_usuario, item]),
      ).values()] }));
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No pudimos consultar los integrantes.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  return <section aria-label="Reportar integrante">
    <h3>Reportar integrante</h3>
    <p>Selecciona a una persona del arriendo. El servidor comprobará la relación antes de aceptar el reporte.</p>
    {!page && !error && <Button variant="secondary" disabled={loading} onClick={() => void load()}>Consultar integrantes</Button>}
    {loading && <p role="status">Consultando integrantes…</p>}
    {error && <><p role="alert">{error}</p><Button disabled={loading} onClick={() => void load(retry.current)}>Reintentar</Button></>}
    {page && <ul>{page.items.map(member => <li key={member.id_usuario}>
      <Link href={`/mis-reportes?usuario=${member.id_usuario}`}>Reportar a {member.nombre || `integrante #${member.id_usuario}`}</Link>
    </li>)}</ul>}
    {page && !page.items.length && <p>No hay integrantes disponibles para consultar.</p>}
    {page?.siguiente_cursor && !error && <Button variant="secondary" disabled={loading} onClick={() => void load(page.siguiente_cursor!)}>Más integrantes</Button>}
  </section>;
}
