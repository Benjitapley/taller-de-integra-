import type { MensajeConvivencia } from "@/types/Convivencia";

// M4-D04 — datos simulados para los chats contextuales (exploratorios /
// de postulación), distintos del chat grupal de Arriendo.

export type EstadoChatExploratorio = "pendiente" | "preseleccionada" | "aceptada" | "rechazada";

export interface PublicacionContexto {
  imagenUrl: string;
  titulo: string;
  subtitulo: string;
}

export interface ChatExploratorio {
  id: string;
  nombreOtraPersona: string;
  avatarUrl: string;
  estado: EstadoChatExploratorio;
  publicacion: PublicacionContexto;
  mensajes: MensajeConvivencia[];
}

// Dos casos a propósito: uno "preseleccionada" (mockup m_chat_contexto,
// el chat se puede ver) y uno que no lo está (para demostrar el criterio
// "solo se muestra chat de postulación simulado cuando está
// preseleccionada"). El estado real de postulaciones es tarea de Abdiel
// (M4-C09, Sprint 2 semana 3); mientras no exista, se simula acá.

export const CHATS_EXPLORATORIOS_MOCK: ChatExploratorio[] = [
  {
    id: "sofia-munoz",
    nombreOtraPersona: "Sofía Muñoz",
    avatarUrl: "https://i.pravatar.cc/150?img=25",
    estado: "preseleccionada",
    publicacion: {
      imagenUrl: "https://picsum.photos/seed/chat-sofia/200/200",
      titulo: "Busco roomie para departamento",
      subtitulo: "Publicación compartida · Temuco Centro",
    },
    mensajes: [
      {
        id: "cs1",
        autorNombre: "Sofía Muñoz",
        autorFotoUrl: "https://i.pravatar.cc/150?img=25",
        texto: "¡Hola! Gracias por escribirme 😊",
        hora: "10:15",
        esPropio: false,
      },
      {
        id: "cs2",
        autorNombre: "Matías",
        autorFotoUrl: "https://i.pravatar.cc/150?img=12",
        texto: "Hola Sofía, vi tu publicación. ¿Aún buscas alguien para compartir?",
        hora: "10:17",
        esPropio: true,
      },
    ],
  },
  {
    id: "camila-soto",
    nombreOtraPersona: "Camila Soto",
    avatarUrl: "https://i.pravatar.cc/150?img=47",
    estado: "pendiente",
    publicacion: {
      imagenUrl: "https://picsum.photos/seed/chat-camila/200/200",
      titulo: "Depto en Providencia",
      subtitulo: "Arriendo · $250.000 · 2 cupos",
    },
    mensajes: [],
  },
];
