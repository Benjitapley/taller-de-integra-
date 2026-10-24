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
  horaTexto: string; // "19:00"
}

export interface InfoArriendo {
  direccion: string; // "Providencia, Santiago"
  numeroDepto: string; // "Depto 4D/2B"
}
