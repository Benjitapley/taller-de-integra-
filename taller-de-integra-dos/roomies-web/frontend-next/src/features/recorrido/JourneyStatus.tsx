import type { EstadoArriendo, EstadoPostulacion, EstadoTarea } from "./types";

const postulacionLabels: Record<EstadoPostulacion, { label: string; tone: "pending" | "positive" | "negative" | "neutral" }> = {
  Pendiente: { label: "Pendiente", tone: "pending" },
  Preseleccionada: { label: "Preseleccionada", tone: "pending" },
  Aceptada: { label: "Aceptada", tone: "positive" },
  Rechazada: { label: "Rechazada", tone: "negative" },
  Cancelada: { label: "Cancelada", tone: "neutral" },
};

const arriendoLabels: Record<EstadoArriendo, { label: string; tone: "positive" | "neutral" }> = {
  Activo: { label: "Activo", tone: "positive" },
  Finalizado: { label: "Finalizado", tone: "neutral" },
};

const tareaLabels: Record<EstadoTarea, { label: string; tone: "pending" | "positive" }> = {
  Pendiente: { label: "Pendiente", tone: "pending" },
  Completada: { label: "Completada", tone: "positive" },
};

export function PostulationStatus({ estado }: { estado: EstadoPostulacion }) {
  const value = postulacionLabels[estado];
  return <span className={`journey-status journey-status-${value.tone}`}>{value.label}</span>;
}

export function ArriendoStatus({ estado }: { estado: EstadoArriendo }) {
  const value = arriendoLabels[estado];
  return <span className={`journey-status journey-status-${value.tone}`}>{value.label}</span>;
}

export function TareaStatus({ estado }: { estado: EstadoTarea }) {
  const value = tareaLabels[estado];
  return <span className={`journey-status journey-status-${value.tone}`}>{value.label}</span>;
}
