import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  obtenerMisPostulaciones,
  retirarPostulacion,
  type OpcionesMisPostulaciones,
  type ResultadoMisPostulaciones,
  type ResultadoRetiro,
} from "@/services/postulacionesService";
import type { ErrorHttp } from "@/types/Http";
import type { Postulacion } from "@/types/Postulacion";

export type EstadoCargaPostulaciones = "cargando" | "listo" | "error";

type Obtener = (opciones?: OpcionesMisPostulaciones) => Promise<ResultadoMisPostulaciones>;
type Retirar = (idPostulacion: number) => Promise<ResultadoRetiro>;

// Con `limite`, Listado responde { items, siguiente_cursor }; sin él devuelve todo como arreglo.
const LIMITE_PAGINA = 20;

// Carga las postulaciones de la persona (GET /api/postulaciones/mias, con cursor)
// cada vez que la pantalla vuelve a estar a la vista, para que el estado que decidió
// el arrendador se actualice sin reiniciar la app.
//
// La primera carga y "Reintentar" muestran el indicador de carga. Una recarga al
// volver a la pantalla conserva lo que ya se veía: si falla, no reemplaza una
// lista buena por un error.
//
// `cargarMas` pide la página siguiente con `siguiente_cursor`. `retirar` deja que el
// servidor decida el resultado y vuelve a leer la lista: la fila no se cambia a mano.
export function useMisPostulaciones(
  obtener: Obtener = obtenerMisPostulaciones,
  retirarEnServidor: Retirar = retirarPostulacion,
) {
  const [estado, setEstado] = useState<EstadoCargaPostulaciones>("cargando");
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([]);
  const [error, setError] = useState<ErrorHttp | null>(null);
  const [siguienteCursor, setSiguienteCursor] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState<ErrorHttp | null>(null);
  const [idRetirando, setIdRetirando] = useState<number | null>(null);

  const tieneDatos = useRef(false);
  const retirandoRef = useRef(false); // evita el doble toque antes del re-render
  const masEnCurso = useRef(false);
  // Número de la última solicitud: una respuesta atrasada no pisa a una más nueva
  // ni actualiza la pantalla después de salir de ella.
  const solicitud = useRef(0);

  const cargar = useCallback(
    async (mostrarCarga: boolean) => {
      const numero = ++solicitud.current;
      if (mostrarCarga) setEstado("cargando");

      const resultado = await obtener({ limite: LIMITE_PAGINA });
      if (numero !== solicitud.current) return;

      if (resultado.exito) {
        tieneDatos.current = true;
        setPostulaciones(resultado.datos.items);
        setSiguienteCursor(resultado.datos.siguienteCursor);
        setError(null);
        setErrorMas(null);
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

  const cargarMas = useCallback(async () => {
    if (!siguienteCursor || masEnCurso.current) return;
    masEnCurso.current = true;
    setCargandoMas(true);
    setErrorMas(null);
    const numero = solicitud.current;

    const resultado = await obtener({ cursor: siguienteCursor });

    masEnCurso.current = false;
    setCargandoMas(false);
    // Si mientras tanto se recargó la lista, el cursor ya no corresponde.
    if (numero !== solicitud.current) return;

    if (!resultado.exito) {
      setErrorMas(resultado);
      return;
    }
    setPostulaciones((actuales) => {
      const conocidas = new Set(actuales.map((p) => p.idPostulacion));
      return [...actuales, ...resultado.datos.items.filter((p) => !conocidas.has(p.idPostulacion))];
    });
    setSiguienteCursor(resultado.datos.siguienteCursor);
  }, [obtener, siguienteCursor]);

  /** Retira una postulación. Devuelve el resultado para que la pantalla lo explique. */
  const retirar = useCallback(
    async (idPostulacion: number): Promise<ResultadoRetiro | null> => {
      if (retirandoRef.current) return null;
      retirandoRef.current = true;
      setIdRetirando(idPostulacion);

      const resultado = await retirarEnServidor(idPostulacion);

      retirandoRef.current = false;
      setIdRetirando(null);
      // Éxito o no, se relee la lista: lo que se ve es lo que dice el servidor
      // (un 409 puede significar que el estado cambió desde otra parte).
      void cargar(false);
      return resultado;
    },
    [cargar, retirarEnServidor],
  );

  return {
    estado,
    postulaciones,
    error,
    reintentar,
    hayMas: siguienteCursor !== null,
    cargandoMas,
    errorMas,
    cargarMas,
    idRetirando,
    retirar,
  };
}
