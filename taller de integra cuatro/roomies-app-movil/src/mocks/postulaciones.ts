import type { Postulacion } from '@/types/Postulacion';

// Para ver cada estado: /postulaciones?idPublicacion=1 (Pendiente), =4
// (Preseleccionada), =5 (Aceptada) y =6 (Rechazada).
export const postulacionesMock: Postulacion[] = [
  {
    idPostulacion: 1,
    idPublicacion: 1,
    idUsuario: 1,
    estado: 'Pendiente',
    fechaPostulacion: '2026-10-29T15:00:00Z',
  },
  {
    idPostulacion: 2,
    idPublicacion: 4,
    idUsuario: 1,
    estado: 'Preseleccionada',
    fechaPostulacion: '2026-10-26T15:00:00Z',
  },
  {
    idPostulacion: 3,
    idPublicacion: 5,
    idUsuario: 1,
    estado: 'Aceptada',
    fechaPostulacion: '2026-10-20T15:00:00Z',
  },
  {
    idPostulacion: 4,
    idPublicacion: 6,
    idUsuario: 1,
    estado: 'Rechazada',
    fechaPostulacion: '2026-10-14T15:00:00Z',
  },
];
