import type { Evaluacion } from '@/types/Evaluacion';

export const evaluacionesMock: Evaluacion[] = [
  {
    idEvaluacion: 1,
    evaluadorNombre: 'Camila Soto',
    evaluadorFotoUrl: 'https://i.pravatar.cc/150?img=5',
    puntuacion: 5,
    fechaEvaluacion: '2026-08-15',
    comentario: 'Muy responsable y buena convivencia.',
  },
  {
    idEvaluacion: 2,
    evaluadorNombre: 'Diego Pérez',
    evaluadorFotoUrl: 'https://i.pravatar.cc/150?img=12',
    puntuacion: 4,
    fechaEvaluacion: '2026-07-28',
    comentario: 'Todo bien durante la convivencia.',
  },
];