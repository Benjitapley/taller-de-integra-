import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { obtenerPostulacion, type ResultadoPostulacionDetalle } from "@/services/postulacionesService";
import type { Postulacion } from "@/types/Postulacion";

type Obtener = (idPostulacion: number) => Promise<ResultadoPostulacionDetalle>;

// Lee GET /api/postulaciones/{id} cada vez que la pantalla vuelve a estar a la vista
// y cuando cambia el estado que muestra la lista (por ejemplo, tras un retiro).
//
// Es una lectura "de refresco": la lista ya trae lo necesario para dibujar la
// pantalla, así que si esta consulta falla no se muestra ningún error ni se pierde
// lo que ya se veía; simplemente se sigue con el dato de la lista. Si funciona, el
// detalle manda, porque es la fuente más reciente del estado.
export function useDetallePostulacion(
  idPostulacion: number | undefined,
  estadoEnLista: Postulacion["estado"] | undefined,
  obtener: Obtener = obtenerPostulacion,
): Postulacion | null {
  // Se guarda con el estado de la lista que había al pedirlo: si la lista cambia
  // (p. ej. tras un retiro), un detalle más viejo se descarta hasta que llegue el nuevo.
  const [leido, setLeido] = useState<{ postulacion: Postulacion; base: Postulacion["estado"] | undefined } | null>(null);
  const solicitud = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (idPostulacion === undefined) return undefined;
      const numero = ++solicitud.current;

      void obtener(idPostulacion).then((resultado) => {
        // Una respuesta atrasada o de otra postulación no pisa a la actual.
        if (numero !== solicitud.current || !resultado.exito) return;
        setLeido({ postulacion: resultado.datos, base: estadoEnLista });
      });
      return () => {
        solicitud.current++;
      };
      // `estadoEnLista` fuerza una nueva lectura cuando la lista detecta un cambio.
    }, [idPostulacion, estadoEnLista, obtener]),
  );

  return leido !== null && leido.base === estadoEnLista && leido.postulacion.idPostulacion === idPostulacion
    ? leido.postulacion
    : null;
}
