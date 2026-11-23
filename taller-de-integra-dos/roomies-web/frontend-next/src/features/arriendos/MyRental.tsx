"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ReportMembers from "@/features/reportes/ReportMembers";

type Rental = { id_arriendo: number; id_publicacion: number; cupos_totales: number; ocupacion: number; es_dueno?: boolean };
type Member = { id_usuario: number; nombre?: string; fecha_ingreso: string; fecha_salida?: string | null; es_responsable?: boolean };
type Publication = { id_publicacion?: number; titulo?: string; ubicacion?: string; precio?: number; cupos_totales?: number; cupos_disponibles?: number | null };

export default function MyRental({ rentalId, publicationId, canReport = false }: { rentalId?: string; publicationId?: string; canReport?: boolean }) {
  const [rental, setRental] = useState<Rental | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const rentalPath = publicationId ? `/web-api/arriendos/por-publicacion/${publicationId}` : rentalId ? `/web-api/arriendos/${rentalId}` : "/web-api/arriendos/mio";
      const rentalResponse = await fetch(rentalPath, { cache: "no-store", credentials: "same-origin", signal });
      if (rentalResponse.status === 404) { setRental(null); setPublication(null); setMembers([]); setNextCursor(null); return; }
      if (!rentalResponse.ok) throw new Error();
      const rentalValue = await rentalResponse.json();
      if (!rentalValue || !Number.isSafeInteger(rentalValue.id_arriendo) || !Number.isSafeInteger(rentalValue.id_publicacion) ||
          !Number.isSafeInteger(rentalValue.cupos_totales) || !Number.isSafeInteger(rentalValue.ocupacion)) throw new Error();
      setRental(rentalValue);
      const [membersResponse, publicationResponse] = await Promise.all([
        fetch(`/web-api/arriendos/${rentalValue.id_arriendo}/integrantes?limite=20`, { cache: "no-store", credentials: "same-origin", signal }),
        fetch(`/web-api/publicaciones/${rentalValue.id_publicacion}`, { cache: "no-store", credentials: "same-origin", signal }),
      ]);
      if (!membersResponse.ok) throw new Error();
      const value = await membersResponse.json();
      if (!value || !Array.isArray(value.items) || !value.items.every((member: Member) => Number.isSafeInteger(member?.id_usuario) && member.id_usuario > 0 && typeof member.fecha_ingreso === "string") ||
          !(value.siguiente_cursor === null || typeof value.siguiente_cursor === "string")) throw new Error();
      setMembers(value.items);
      setNextCursor(value.siguiente_cursor);
      if (!publicationResponse.ok) throw new Error();
      const publicationValue = await publicationResponse.json();
      if (!publicationValue || publicationValue.id_publicacion !== rentalValue.id_publicacion || typeof publicationValue.titulo !== "string") throw new Error();
      setPublication(publicationValue);
    } catch {
      if (!signal?.aborted) setError("No se pudo cargar Mi arriendo.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function loadMore() {
    if (!rental || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/web-api/arriendos/${rental.id_arriendo}/integrantes?limite=20&cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      const page = await response.json();
      if (!page || !Array.isArray(page.items) || !page.items.every((member: Member) => Number.isSafeInteger(member?.id_usuario) && member.id_usuario > 0 && typeof member.fecha_ingreso === "string") ||
          !(page.siguiente_cursor === null || typeof page.siguiente_cursor === "string")) throw new Error();
      setMembers(current => [...current, ...page.items]);
      setNextCursor(page.siguiente_cursor);
    } catch { setError("No se pudieron cargar más integrantes."); }
    finally { setLoadingMore(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  function closeRetirement() {
    if (retiring) return;
    setSelected(null);
    setReason("");
    setConfirmed(false);
  }

  async function retireMember() {
    if (!rental || !selected || retiring) return;
    if (!reason.trim() || reason.length > 500 || !confirmed) {
      setError("Indica un motivo de máximo 500 caracteres y confirma el retiro.");
      return;
    }
    setRetiring(true);
    setError("");
    try {
      const response = await fetch(`/web-api/arriendos/${rental.id_arriendo}/expulsiones`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
        body: JSON.stringify({ id_usuario: selected.id_usuario, motivo: reason.trim(), confirmo: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || "No se pudo retirar al integrante.");
      closeRetirement();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo retirar al integrante.");
    } finally {
      setRetiring(false);
    }
  }

  return <main>
    <PageHeader title={rentalId || publicationId ? "Integrantes del arriendo" : "Mi arriendo"} description="Consulta la publicación, capacidad e integrantes con acceso autorizado." />
    {loading ? <Card><p>Cargando tu arriendo…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p><Button onClick={() => void load()}>Reintentar</Button></Card> : null}
    {!loading && !error && !rental ? <Card><p>No tienes un arriendo activo.</p></Card> : null}
    {!loading && !error && rental ? <>
      <Card>
        <h2>Arriendo {rental.id_arriendo}</h2>
        <h2>{publication?.titulo || `Publicación ${rental.id_publicacion}`}</h2>
        {publication?.ubicacion && <p>{publication.ubicacion}</p>}
        <p>Capacidad: {rental.ocupacion} de {rental.cupos_totales} integrantes · {Math.max(0, rental.cupos_totales - rental.ocupacion)} cupos disponibles</p>
        {rental.es_dueno ? <p>Vista de dueño: integrantes visibles; conversaciones y tareas son privadas para integrantes.</p> : null}
      </Card>
      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        {members.length === 0 ? <Card><p>No hay integrantes activos.</p></Card> : members.map(member =>
          <Card key={member.id_usuario}>
            <h3 style={{ marginTop: 0 }}>{member.nombre || `Usuario ${member.id_usuario}`}</h3>
            {member.es_responsable ? <p><strong>Responsable</strong></p> : null}
            <p>Ingreso: {member.fecha_ingreso}</p>
            {rental.es_dueno ? <Button variant="secondary" disabled={retiring} onClick={() => { setSelected(member); setError(""); }}>Retirar integrante</Button> : null}
          </Card>
        )}
      </div>
      {nextCursor ? <div style={{ marginTop: 16 }}><Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Cargando…" : "Cargar más integrantes"}</Button></div> : null}
      {canReport && !rental.es_dueno ? <Card><ReportMembers rentalId={rental.id_arriendo} /></Card> : null}
      {selected ? <Card>
        <h2>Retirar a {selected.nombre || `Usuario ${selected.id_usuario}`}</h2>
        <p>El integrante perderá de inmediato el acceso al chat y a las tareas.</p>
        <label>Motivo
          <textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          Confirmo que deseo retirar a este integrante.
        </label>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <Button disabled={retiring} onClick={() => void retireMember()}>{retiring ? "Retirando…" : "Confirmar retiro"}</Button>
          <Button variant="secondary" disabled={retiring} onClick={closeRetirement}>Cancelar</Button>
        </div>
      </Card> : null}
    </> : null}
  </main>;
}
