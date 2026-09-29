import type { TipoPublicacion } from "@/components/Publicacion_Card";

// Modelos usados por la pantalla de Perfil (MOB-08).
// El campo "estado" de Usuario y el tipo de Publicacion ahora reutilizan
// TipoPublicacion ('arriendo' | 'se_busca' | 'se_necesita'), definido en
// Publicacion_Card.tsx (componente de un compañero, probablemente MOB-03).
// Antes existía un EstadoPublicacion propio en constants/estadosPublicacion.ts
// con solo 2 valores — se eliminó ese archivo para no tener dos taxonomías
// distintas conviviendo.

export interface Usuario {
  id: string;
  nombre: string;
  fotoUrl: string;
  calificacionPromedio: number;
  cantidadEvaluaciones: number;
  estado: TipoPublicacion;
  ubicacion: string;
  edad: number;
  ocupacion: string;
  bio: string;
  stats: {
    publicaciones: number;
    mensajes: number;
    guardados: number;
    evaluaciones: number;
  };
  preferencias: string[];
  buscaEn: string[];
  presupuestoMaxCLP: number;
}

export interface Publicacion {
  id: string;
  tipo: TipoPublicacion;
  titulo: string;
  imagenUrl?: string;
  personas?: string;
  precio?: string;
  ubicacion?: string;
  descripcion?: string;
  publicadoHace: string;
}

export interface Evaluacion {
  id: string;
  evaluadorNombre: string;
  evaluadorFotoUrl: string;
  calificacion: number;
  fechaTexto: string;
  comentario: string;
}
