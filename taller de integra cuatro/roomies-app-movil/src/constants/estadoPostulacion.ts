import { colors } from '@/theme/colors';
import type { EstadoPostulacion } from '@/types/Postulacion';

export const configPorEstadoPostulacion: Record<
  EstadoPostulacion,
  { etiqueta: string; color: string; fondo: string }
> = {
  Pendiente: { etiqueta: 'Postulación enviada', color: colors.primary, fondo: '#EEEBFF' },
  Preseleccionada: { etiqueta: 'Preseleccionada', color: colors.primary, fondo: '#EEEBFF' },
  Aceptada: { etiqueta: 'Aceptada', color: '#15803D', fondo: '#DCFCE7' },
  Rechazada: { etiqueta: 'Rechazada', color: '#B91C1C', fondo: '#FEE2E2' },
};

/**
 * Cómo se dibuja cada paso de la línea de estado (mockup m_postulacion):
 * - hecho: círculo lleno con check
 * - actual: círculo claro con anillo (lo que se espera ahora)
 * - inactivo: círculo claro con punto tenue (aún no ocurre)
 * - rechazado: círculo rojo con X (solo el paso de decisión)
 */
export type MarcadorPaso = 'hecho' | 'actual' | 'inactivo' | 'rechazado';

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
};

// Tarjeta "Chat con arrendador". El chat de postulación existe solo mientras la
// postulación está Preseleccionada, en los otros estados la tarjeta no se muestra.
export const chatPorEstadoPostulacion: Record<
  EstadoPostulacion,
  { texto: string; nota?: string } | null
> = {
  Pendiente: { texto: 'Se habilitará únicamente si el arrendador te preselecciona.' },
  Preseleccionada: {
    texto: 'El arrendador te preseleccionó: se habilitará una conversación con él.',
    nota: 'Disponible cuando se conecte la mensajería (M4-D04).',
  },
  Aceptada: null,
  Rechazada: null,
};
