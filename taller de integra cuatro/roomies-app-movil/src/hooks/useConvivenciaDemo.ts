import { useSyncExternalStore } from "react";
import {
  RECORDATORIOS_MOCK,
  TAREAS_MOCK,
  TAREAS_PROXIMAS_MOCK,
} from "@/data/convivenciaMock";
import type {
  NuevaTareaInput,
  NuevoRecordatorioInput,
  Recordatorio,
  TareaConvivencia,
} from "@/types/Convivencia";

// M4-D09 — estado DEMOSTRATIVO de tareas y recordatorios, en un solo lugar.
//
// Antes cada pantalla/modal guardaba su propia copia (useState dentro del
// dashboard), así que una tarea creada ahí no aparecía en "Ver todo". Ahora
// hay una única fuente: un estado a nivel de módulo al que se suscriben todas
// las pantallas que usen este hook (useSyncExternalStore).
//
// Alcance y límites, a propósito:
// - Vive en memoria. Sobrevive a la navegación entre pantallas, pero se
//   pierde al reiniciar la app (= "reiniciar la demo"). NO hay persistencia
//   ni sincronización remota, y nada en la UI debe sugerir lo contrario.
// - Es reemplazable: cuando exista el servicio de Convivencia (Sprint 3),
//   este hook se sustituye por llamadas a la API manteniendo la misma forma
//   de retorno, y las pantallas no deberían cambiar.
// - Nunca se modifican los arreglos de convivenciaMock.ts: cada alta crea un
//   arreglo nuevo, así los mocks originales quedan intactos.

type EstadoDemo = {
  tareas: TareaConvivencia[];
  recordatorios: Recordatorio[];
};

let estado: EstadoDemo = {
  tareas: TAREAS_MOCK,
  recordatorios: RECORDATORIOS_MOCK,
};

const oyentes = new Set<() => void>();
let contadorIds = 0;

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function obtenerEstado(): EstadoDemo {
  return estado;
}

function actualizar(siguiente: EstadoDemo) {
  estado = siguiente;
  oyentes.forEach((oyente) => oyente());
}

export function agregarTarea(nueva: NuevaTareaInput): void {
  contadorIds += 1;
  const tarea: TareaConvivencia = {
    id: `demo-tarea-${contadorIds}`,
    categoria: nueva.nombre,
    icono: "checkbox-outline", // el formulario no pide categoría
    diaTexto: nueva.fechaTexto,
    descripcion: nueva.descripcion,
    responsable: nueva.responsable,
  };
  actualizar({ ...estado, tareas: [...estado.tareas, tarea] });
}

export function agregarRecordatorio(nuevo: NuevoRecordatorioInput): void {
  contadorIds += 1;
  const recordatorio: Recordatorio = {
    id: `demo-recordatorio-${contadorIds}`,
    titulo: nuevo.titulo,
    fechaTexto: nuevo.fechaTexto,
    horaTexto: nuevo.horaTexto,
    descripcion: nuevo.descripcion,
  };
  actualizar({ ...estado, recordatorios: [...estado.recordatorios, recordatorio] });
}

export function useConvivenciaDemo() {
  const { tareas, recordatorios } = useSyncExternalStore(suscribir, obtenerEstado, obtenerEstado);

  return {
    tareas,
    // Las "próximas tareas" siguen siendo de solo lectura: el formulario no
    // distingue entre esta semana y las siguientes (la fecha es texto libre).
    tareasProximas: TAREAS_PROXIMAS_MOCK,
    recordatorios,
    agregarTarea,
    agregarRecordatorio,
  };
}
