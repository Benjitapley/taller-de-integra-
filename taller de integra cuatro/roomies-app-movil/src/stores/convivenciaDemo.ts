import { RECORDATORIOS_MOCK, TAREAS_MOCK } from "@/data/convivenciaMock";
import type { NuevaTareaInput, NuevoRecordatorioInput, Recordatorio, TareaConvivencia } from "@/types/Convivencia";

type EstadoDemo = { tareas: TareaConvivencia[]; recordatorios: Recordatorio[] };

/** Una instancia por sesión, compartida entre dashboard y detalle de tareas. */
export function crearAlmacenConvivenciaDemo() {
  let estado: EstadoDemo = { tareas: [...TAREAS_MOCK], recordatorios: [...RECORDATORIOS_MOCK] };
  const oyentes = new Set<() => void>();
  let contadorIds = 0;

  function suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => { oyentes.delete(oyente); };
  }
  function obtenerEstado() { return estado; }
  function actualizar(siguiente: EstadoDemo) {
    estado = siguiente;
    oyentes.forEach((oyente) => oyente());
  }
  function agregarTarea(nueva: NuevaTareaInput) {
    contadorIds += 1;
    const tarea: TareaConvivencia = {
      id: `demo-tarea-${contadorIds}`, categoria: nueva.nombre, icono: "checkbox-outline",
      diaTexto: nueva.fechaTexto, descripcion: nueva.descripcion, responsable: nueva.responsable,
    };
    actualizar({ ...estado, tareas: [...estado.tareas, tarea] });
  }
  function agregarRecordatorio(nuevo: NuevoRecordatorioInput) {
    contadorIds += 1;
    const recordatorio: Recordatorio = { id: `demo-recordatorio-${contadorIds}`, ...nuevo };
    actualizar({ ...estado, recordatorios: [...estado.recordatorios, recordatorio] });
  }
  return { suscribir, obtenerEstado, agregarTarea, agregarRecordatorio };
}

export type AlmacenConvivenciaDemo = ReturnType<typeof crearAlmacenConvivenciaDemo>;
