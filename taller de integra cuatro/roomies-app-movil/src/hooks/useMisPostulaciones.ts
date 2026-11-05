import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  obtenerMisPostulaciones,
  type ResultadoMisPostulaciones,
} from "@/services/postulacionesService";
import type { ErrorHttp } from "@/types/Http";
import type { Postulacion } from "@/types/Postulacion";

export type EstadoCargaPostulaciones = "cargando" | "listo" | "error";

// Carga las postulaciones de la persona (GET /api/postulaciones/mias) cada vez
// que la pantalla vuelve a estar a la vista, para que el estado que decidió el
// arrendador se actualice sin reiniciar la app.
//
// La primera carga y "Reintentar" muestran el indicador de carga. Una recarga al
// volver a la pantalla conserva lo que ya se veía: si falla, no reemplaza una
// lista buena por un error.
export function useMisPostulaciones(
  obtener: () => Promise<ResultadoMisPostulaciones> = obtenerMisPostulaciones,
) {
  const [estado, setEstado] = useState<EstadoCargaPostulaciones>("cargando");
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([]);
  const [error, setError] = useState<ErrorHttp | null>(null);

  const tieneDatos = useRef(false);
  // Número de la última solicitud: una respuesta atrasada no pisa a una más nueva
  // ni actualiza la pantalla después de salir de ella.
  const solicitud = useRef(0);

  const cargar = useCallback(
    async (mostrarCarga: boolean) => {
      const numero = ++solicitud.current;
      if (mostrarCarga) setEstado("cargando");

      const resultado = await obtener();
      if (numero !== solicitud.current) return;

      if (resultado.exito) {
        tieneDatos.current = true;
        setPostulaciones(resultado.datos);
        setError(null);
        setEstado("listo");
        return;
      }
      if (tieneDatos.current) return;
      setError(resultado);
      setEstado("error");
    },
    [obtener],
  );

  useFocusEffect(
    useCallback(() => {
      void cargar(!tieneDatos.current);
      return () => {
        solicitud.current++;
      };
    }, [cargar]),
  );

  const reintentar = useCallback(() => {
    void cargar(true);
  }, [cargar]);

  return { estado, postulaciones, error, reintentar };
}
