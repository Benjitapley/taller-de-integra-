import { colors } from '@/theme/colors';
import {
  MOTIVO_CIERRE_PUBLICACION,
  MOTIVO_OTRO_ARRIENDO,
  MOTIVO_RETIRO_VOLUNTARIO,
  type EstadoPostulacion,
} from '@/types/Postulacion';

export const configPorEstadoPostulacion: Record<
  EstadoPostulacion,
  { etiqueta: string; color: string; fondo: string }
> = {
  Pendiente: { etiqueta: 'Postulación enviada', color: colors.primary, fondo: '#EEEBFF' },
  Preseleccionada: { etiqueta: 'Preseleccionada', color: colors.primary, fondo: '#EEEBFF' },
  Aceptada: { etiqueta: 'Aceptada', color: '#15803D', fondo: '#DCFCE7' },
  Rechazada: { etiqueta: 'Rechazada', color: '#B91C1C', fondo: '#FEE2E2' },
  Cancelada: { etiqueta: 'Cancelada', color: '#4B5563', fondo: '#E5E7EB' },
};

/**
 * Cómo se dibuja cada paso de la línea de estado (mockup m_postulacion):
 * - hecho: círculo lleno con check
 * - actual: círculo claro con anillo (lo que se espera ahora)
 * - inactivo: círculo claro con punto tenue (aún no ocurre)
 * - rechazado: círculo rojo con X (solo el paso de decisión)
 * - cancelado: círculo gris con X (la persona canceló su postulación)
 */
export type MarcadorPaso = 'hecho' | 'actual' | 'inactivo' | 'rechazado' | 'cancelado';

export interface PasoPostulacion {
  titulo: string;
  descripcion: string;
  marcador: MarcadorPaso;
}

const TITULOS = ['Solicitud enviada', 'En revisión', 'Decisión'] as const;

const SOLICITUD_ENVIADA = 'El arrendador recibió tu solicitud.';
const REVISADA = 'El arrendador revisó tu solicitud.';

// Los textos de Pendiente son exactamente los del mockup. Los demás estados
// usan los mismos tres pasos con el avance que corresponde.
export const pasosPorEstadoPostulacion: Record<EstadoPostulacion, PasoPostulacion[]> = {
  Pendiente: [
    { titulo: TITULOS[0], descripcion: SOLICITUD_ENVIADA, marcador: 'hecho' },
    { titulo: TITULOS[1], descripcion: 'Te avisaremos si eres preseleccionado.', marcador: 'inactivo' },
    { titulo: TITULOS[2], descripcion: 'Pendiente de respuesta.', marcador: 'actual' },
  ],
  Preseleccionada: [
    { titulo: TITULOS[0], descripcion: SOLICITUD_ENVIADA, marcador: 'hecho' },
    { titulo: TITULOS[1], descripcion: 'Fuiste preseleccionado.', marcador: 'hecho' },
    { titulo: TITULOS[2], descripcion: 'Pendiente de respuesta.', marcador: 'actual' },
  ],
  Aceptada: [
    { titulo: TITULOS[0], descripcion: SOLICITUD_ENVIADA, marcador: 'hecho' },
    { titulo: TITULOS[1], descripcion: REVISADA, marcador: 'hecho' },
    { titulo: TITULOS[2], descripcion: 'Tu postulación fue aceptada.', marcador: 'hecho' },
  ],
  Rechazada: [
    { titulo: TITULOS[0], descripcion: SOLICITUD_ENVIADA, marcador: 'hecho' },
    { titulo: TITULOS[1], descripcion: REVISADA, marcador: 'hecho' },
    { titulo: TITULOS[2], descripcion: 'Tu postulación no fue seleccionada.', marcador: 'rechazado' },
  ],
  Cancelada: [
    { titulo: TITULOS[0], descripcion: SOLICITUD_ENVIADA, marcador: 'hecho' },
    { titulo: TITULOS[1], descripcion: 'La revisión se detuvo al cancelar.', marcador: 'inactivo' },
    { titulo: TITULOS[2], descripcion: descripcionCancelacion(), marcador: 'cancelado' },
  ],
};

// La cancelación la fija el retiro, el cierre del aviso o la incorporación a otro
// arriendo (contrato 4.2). El texto del paso final sale del motivo que informa el
// servidor: no se afirma "Cancelaste" si la cancelación no la hizo la persona.
export function descripcionCancelacion(motivo?: string): string {
  if (motivo === MOTIVO_RETIRO_VOLUNTARIO) return 'Retiraste tu postulación.';
  if (motivo === MOTIVO_CIERRE_PUBLICACION) return 'El arrendador cerró la publicación.';
  if (motivo === MOTIVO_OTRO_ARRIENDO) return 'Te incorporaste a otro arriendo.';
  return 'La postulación fue cancelada.';
}

export function pasosDePostulacion(estado: EstadoPostulacion, motivo?: string): PasoPostulacion[] {
  const pasos = pasosPorEstadoPostulacion[estado];
  if (estado !== 'Cancelada') return pasos;
  return pasos.map((paso, indice) =>
    indice === 2 ? { ...paso, descripcion: descripcionCancelacion(motivo) } : paso,
  );
}

// Tarjeta "Chat con arrendador". El contrato (4.2) dice que la preselección es un
// estado visible y no abre ningún chat, así que ningún estado muestra la tarjeta.
export const chatPorEstadoPostulacion: Record<
  EstadoPostulacion,
  { texto: string; nota?: string } | null
> = {
  Pendiente: null,
  Preseleccionada: null,
  Aceptada: null,
  Rechazada: null,
  Cancelada: null,
};
