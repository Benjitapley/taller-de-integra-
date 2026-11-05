import { useContext, useSyncExternalStore } from "react";
import { ConvivenciaDemoContext } from "@/components/convivencia/ConvivenciaDemoProvider";
import { TAREAS_PROXIMAS_MOCK } from "@/data/convivenciaMock";

// D09 conserva un estado demostrativo compartido entre pantallas. Vive en
// memoria y se descarta al reiniciar o cambiar de identidad Supabase; no usa API.
export function useConvivenciaDemo() {
  const contexto = useContext(ConvivenciaDemoContext);
  if (!contexto) throw new Error("useConvivenciaDemo requiere ConvivenciaDemoProvider");
  const { almacen } = contexto;
  const { tareas, recordatorios } = useSyncExternalStore(
    almacen.suscribir, almacen.obtenerEstado, almacen.obtenerEstado,
  );
  return {
    tareas,
    tareasProximas: TAREAS_PROXIMAS_MOCK,
    recordatorios,
    agregarTarea: almacen.agregarTarea,
    agregarRecordatorio: almacen.agregarRecordatorio,
  };
}
