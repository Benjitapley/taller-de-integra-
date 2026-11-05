// Modelos para la pantalla de convivencia (MOB-09/10/11).
// MOB-11 (esta tarea) solo es responsable de TareaConvivencia y su
// visualización; IntegranteConvivencia y MensajeConvivencia se agregaron
// como scaffolding mínimo para poder mostrar la tarjeta en contexto,
// mientras MOB-09/MOB-10 no estén implementadas "en serio".

export interface IntegranteConvivencia {
  id: string;
  nombre: string;
  fotoUrl: string;
}

export interface TareaConvivencia {
  id: string;
  categoria: string; // "Aseo", "Compras", "Cocina"
  icono: string; // nombre de ícono de Ionicons
  frecuenciaTexto?: string; // "Esta semana", "Este finde" (algunas tareas no la muestran)
  diaTexto: string; // "Martes", "Sábado", "Jueves", "Viernes"
  descripcion?: string; // M4-D07: detalle opcional de una tarea creada desde el formulario
  responsable: IntegranteConvivencia;
}

export interface MensajeConvivencia {
  id: string;
  autorNombre: string;
  autorFotoUrl: string;
  texto: string;
  hora: string;
  esPropio: boolean;
}

// M4-D05 — dashboard "Mi arriendo".

export interface Recordatorio {
  id: string;
  titulo: string;
  fechaTexto: string; // "Viernes"
  horaTexto?: string; // "19:00" — opcional según el mockup m_recordatorio (M4-D08)
  descripcion?: string; // opcional (M4-D08)
}

export interface InfoArriendo {
  direccion: string; // "Providencia, Santiago"
  numeroDepto: string; // "Depto 4D/2B"
}

// M4-D07 — datos que entrega el formulario "Nueva tarea" (bottom sheet).
// Es lo que captura la UI; convertirlo en TareaConvivencia (id, ícono) lo
// hace quien lo recibe, para que el formulario no conozca el modelo de lista.
export interface NuevaTareaInput {
  nombre: string;
  descripcion?: string;
  responsable: IntegranteConvivencia;
  fechaTexto: string; // texto libre, ej. "Martes 13 de octubre"
}

// M4-D08 — datos que entrega el formulario "Nuevo recordatorio" (bottom sheet).
export interface NuevoRecordatorioInput {
  titulo: string;
  fechaTexto: string; // texto libre, ej. "Viernes 16 de octubre"
  horaTexto?: string; // "HH:MM", ya validada
  descripcion?: string;
}
