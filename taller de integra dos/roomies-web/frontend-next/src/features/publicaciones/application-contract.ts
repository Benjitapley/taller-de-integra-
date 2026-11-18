export const applicationStates = ["Pendiente", "Preseleccionada", "Aceptada", "Rechazada", "Cancelada"] as const;
export type ApplicationState = typeof applicationStates[number];
export type OwnerDecision = "Preseleccionada" | "Aceptada" | "Rechazada";

export type Application = {
  id_postulacion: number;
  id_publicacion: number;
  id_usuario: number;
  titulo?: string;
  nombre_postulante?: string;
  estado_publicacion?: string;
  fecha_postulacion?: string;
  fecha_estado?: string;
  estado: ApplicationState;
  motivo?: string | null;
  id_arriendo?: number | null;
  incorporacion_pendiente?: boolean;
};

export type CursorPage<T> = { items: T[]; siguiente_cursor: string | null };

export function confirmedRental(application: Application) {
  return application.estado === "Aceptada" && !application.incorporacion_pendiente
    ? application.id_arriendo ?? null
    : null;
}

export function pendingAdmission(application: Application) {
  return application.incorporacion_pendiente === true ||
    (application.estado === "Aceptada" && confirmedRental(application) === null);
}
