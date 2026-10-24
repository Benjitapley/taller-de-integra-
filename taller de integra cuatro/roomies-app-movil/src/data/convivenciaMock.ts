import type {
  InfoArriendo,
  IntegranteConvivencia,
  MensajeConvivencia,
  Recordatorio,
  TareaConvivencia,
} from "@/types/Convivencia";

// Datos simulados compartidos entre la pantalla de Mensajes/Convivencia
// (MOB-09/10/11) y la subpantalla de detalle de tareas. Centralizados acá
// para no duplicar los mismos mocks en dos archivos.

export const INTEGRANTES_MOCK: IntegranteConvivencia[] = [
  { id: "i1", nombre: "Benja", fotoUrl: "https://i.pravatar.cc/150?img=13" },
  { id: "i2", nombre: "Vale", fotoUrl: "https://i.pravatar.cc/150?img=32" },
  { id: "i3", nombre: "Pato", fotoUrl: "https://i.pravatar.cc/150?img=14" },
  { id: "i4", nombre: "Meli", fotoUrl: "https://i.pravatar.cc/150?img=45" },
];

const [BENJA, VALE, PATO, MELI] = INTEGRANTES_MOCK;

// El usuario "actual" simulado (para esPropio en mensajes, y para quién
// escribe al usar el input). En una app real vendría de useAuth().
export const USUARIO_ACTUAL_MOCK = MELI;

export const TAREAS_MOCK: TareaConvivencia[] = [
  { id: "t1", categoria: "Aseo", icono: "sparkles-outline", frecuenciaTexto: "Esta semana", diaTexto: "Martes", responsable: VALE },
  { id: "t2", categoria: "Compras", icono: "cart-outline", frecuenciaTexto: "Este finde", diaTexto: "Sábado", responsable: MELI },
  { id: "t3", categoria: "Cocina", icono: "restaurant-outline", diaTexto: "Jueves", responsable: PATO },
  { id: "t4", categoria: "Cocina", icono: "restaurant-outline", diaTexto: "Viernes", responsable: VALE },
];

// Tareas de la semana siguiente, para la sección "Próximas tareas" de la
// subpantalla de detalle (Ver todo). Datos inventados razonablemente a
// partir del mismo patrón de rotación (Aseo/Compras/Cocina x2).
export const TAREAS_PROXIMAS_MOCK: TareaConvivencia[] = [
  { id: "p1", categoria: "Aseo", icono: "sparkles-outline", frecuenciaTexto: "Próxima semana", diaTexto: "Martes", responsable: PATO },
  { id: "p2", categoria: "Compras", icono: "cart-outline", frecuenciaTexto: "Próximo finde", diaTexto: "Sábado", responsable: BENJA },
  { id: "p3", categoria: "Cocina", icono: "restaurant-outline", diaTexto: "Jueves", responsable: MELI },
  { id: "p4", categoria: "Cocina", icono: "restaurant-outline", diaTexto: "Viernes", responsable: BENJA },
];

export const MENSAJES_MOCK: MensajeConvivencia[] = [
  { id: "m1", autorNombre: BENJA.nombre, autorFotoUrl: BENJA.fotoUrl, texto: "Chiquillos, ¿quién hace el aseo esta semana? 🧹✨", hora: "10:15", esPropio: false },
  { id: "m2", autorNombre: VALE.nombre, autorFotoUrl: VALE.fotoUrl, texto: "Yo puedo hacerlo el martes en la tarde 😊", hora: "10:16", esPropio: false },
  { id: "m3", autorNombre: PATO.nombre, autorFotoUrl: PATO.fotoUrl, texto: "Dalee Valee, gracias!! 🙌", hora: "10:17", esPropio: false },
  { id: "m4", autorNombre: MELI.nombre, autorFotoUrl: MELI.fotoUrl, texto: "Yo me encargo de comprar lo que falte este finde 🛒", hora: "10:18", esPropio: true },
  { id: "m5", autorNombre: BENJA.nombre, autorFotoUrl: BENJA.fotoUrl, texto: "Buenísima! 🙌", hora: "10:18", esPropio: false },
  { id: "m6", autorNombre: PATO.nombre, autorFotoUrl: PATO.fotoUrl, texto: "También puedo cocinar el jueves 🍲", hora: "10:19", esPropio: false },
  { id: "m7", autorNombre: VALE.nombre, autorFotoUrl: VALE.fotoUrl, texto: "Y yo el viernes! hacemos algo rico 😊", hora: "10:19", esPropio: false },
  { id: "m8", autorNombre: MELI.nombre, autorFotoUrl: MELI.fotoUrl, texto: "Equipo top 💜", hora: "10:20", esPropio: true },
];

// M4-D05 — datos para el dashboard "Mi arriendo" (mockup
// n_m_chat_convivencia_03, "Dashboard de Arriendo").

export const INFO_ARRIENDO_MOCK: InfoArriendo = {
  direccion: "Providencia, Santiago",
  numeroDepto: "Depto 4D/2B",
};

export const RECORDATORIOS_MOCK: Recordatorio[] = [
  { id: "r1", titulo: "Pagar internet", fechaTexto: "Viernes", horaTexto: "19:00" },
];

// Último mensaje del chat grupal, para la tarjeta de vista previa del
// dashboard ("Chat del arriendo"). Se deriva del propio MENSAJES_MOCK en
// vez de duplicar el texto a mano, para no desincronizarse si cambia.
export const ULTIMO_MENSAJE_ARRIENDO_MOCK = MENSAJES_MOCK[MENSAJES_MOCK.length - 1];

// M4-D06 — no hay endpoint real de "arriendo activo" todavía (Sprint 3).
// Este flag simula esa respuesta: en true, el usuario ve el dashboard
// normal; en false, ve el estado "Sin arriendo". Para probar el estado
// vacío, cambia este valor a false.
export const USUARIO_TIENE_ARRIENDO_MOCK = true;
