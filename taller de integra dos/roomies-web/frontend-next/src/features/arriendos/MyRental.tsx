"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Rental = { id_arriendo: number; id_publicacion: number; cupos_totales?: number; integrantes_activos?: number; cupos_disponibles?: number; ocupacion?: number; estado?: string };
type Member = { id_usuario: number; nombre?: string; fecha_ingreso: string; fecha_salida?: string | null; es_responsable?: boolean };

export default function MyRental() {
  const [rental, setRental] = useState<Rental | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [retiring, setRetiring] = useState(false);

  async function load(signal?: AbortSignal) {
    setError("");
    try {
      const rentalResponse = await fetch("/web-api/arriendos/mio", { cache: "no-store", credentials: "same-origin", signal });
      if (rentalResponse.status === 404) { setRental(null); setMembers([]); return; }
      if (!rentalResponse.ok) throw new Error();
      const rentalValue = await rentalResponse.json();
      setRental(rentalValue);
      const membersResponse = await fetch(`/web-api/arriendos/${rentalValue.id_arriendo}/integrantes`, { cache: "no-store", credentials: "same-origin", signal });
      if (!membersResponse.ok) throw new Error();
      const value = await membersResponse.json();
      setMembers(Array.isArray(value.items) ? value.items : []);
    } catch {
      if (!signal?.aborted) setError("No se pudo cargar Mi arriendo.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
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
    <PageHeader title="Mi arriendo" description="Consulta tu arriendo activo y sus integrantes." />
    {loading ? <Card><p>Cargando tu arriendo…</p></Card> : null}
    {!loading && error ? <Card><p role="alert">{error}</p><Button onClick={() => void load()}>Reintentar</Button></Card> : null}
    {!loading && !error && !rental ? <Card><p>No tienes un arriendo activo.</p></Card> : null}
    {!loading && !error && rental ? <>
      <Card>
        <h2>Arriendo {rental.id_arriendo}</h2>
        <p>Publicación: {rental.id_publicacion}</p>
        {rental.cupos_disponibles !== undefined && <p>{rental.cupos_disponibles} cupos disponibles</p>}
      </Card>
      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        {members.length === 0 ? <Card><p>No hay integrantes activos.</p></Card> : members.map(member =>
          <Card key={member.id_usuario}>
            <h3 style={{ marginTop: 0 }}>{member.nombre || `Usuario ${member.id_usuario}`}</h3>
            {member.es_responsable ? <p><strong>Responsable</strong></p> : null}
            <p>Ingreso: {member.fecha_ingreso}</p>
            <Button variant="secondary" disabled={retiring} onClick={() => { setSelected(member); setError(""); }}>Retirar integrante</Button>
          </Card>
        )}
      </div>
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
