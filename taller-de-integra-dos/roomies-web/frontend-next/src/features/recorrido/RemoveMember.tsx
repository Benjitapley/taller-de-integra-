"use client";
import { useRef, useState, type FormEvent } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { IntegranteArriendoDto } from "./types";
import styles from "./recorrido.module.css";

export default function RemoveMember({ rentalId, members, onRemoved }: {
  rentalId: string; members: IntegranteArriendoDto[]; onRemoved: (message: string) => void;
}) {
  const [target, setTarget] = useState<IntegranteArriendoDto | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const [revoked, setRevoked] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !target || !reason.trim() || !confirmed) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/web-api/arriendos/${rentalId}/expulsiones`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
        body: JSON.stringify({ id_usuario: target.id_usuario, motivo: reason.trim(), confirmo: confirmed }),
      });
      const result = await response.json();
      if (response.status === 403) setRevoked(true);
      if (!response.ok) throw new Error(result.detail || "No se pudo confirmar el retiro. Puedes reintentar.");
      const message = result.estado === "Finalizado"
        ? "Integrante retirado. El arriendo finalizó y se solicitó cerrar la publicación; no se reabrirá automáticamente."
        : `Integrante retirado. Se liberó un cupo. Cupos disponibles: ${result.cupos_disponibles}.`;
      setTarget(null); setReason(""); setConfirmed(false); onRemoved(message);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo confirmar el retiro."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <Card>
    <h2>Gestión de integrantes</h2>
    <p>Como dueño del aviso puedes retirar a un integrante del arriendo. Esta acción es distinta del retiro voluntario de una postulación.</p>
    {error ? <p role="alert">{error}</p> : null}
    {!revoked ? <div className={styles.actions}>{members.filter(member => member.activo).map(member =>
      <Button key={member.id_usuario} variant="secondary" onClick={() => { setTarget(member); setReason(""); setConfirmed(false); setError(""); }}>
        Retirar a {member.nombre || `integrante #${member.id_usuario}`}
      </Button>)}</div> : null}
    {target && !revoked ? <Modal open={true} title="Retirar integrante" onClose={() => { if (!inFlight.current) setTarget(null); }}>
      <form onSubmit={submit} className={styles.removeDialog}>
        <p>{target.nombre || `Integrante #${target.id_usuario}`} perderá acceso al chat, su historial y las tareas. Sus tareas pendientes quedarán sin asignar.</p>
        <p>Si es el último integrante, el arriendo finalizará y la publicación se cerrará.</p>
        <label htmlFor="remove-reason">Motivo del retiro</label>
        <textarea id="remove-reason" autoFocus required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} />
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} required /> Confirmo que quiero retirar a este integrante.</label>
        {error ? <p role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setTarget(null)}>Cancelar</Button>
          <Button type="submit" disabled={busy || !confirmed || !reason.trim()}>{busy ? "Retirando…" : "Confirmar retiro"}</Button>
        </div>
      </form>
    </Modal> : null}
  </Card>;
}
