import { useCallback, useEffect, useRef, useState } from "react";
import { listarMisPublicaciones } from "@/services/publicacionesService";
import { mensajeDeError } from "@/types/erroresServidor";
import type { PublicacionPropia } from "@/types/PublicacionPropia";

// Mis publicaciones (M4S3-C02): una lista paginada por cursor.
// - Deduplica por id_publicacion (una página puede repetir un aviso si hubo cambios).
// - Descarta respuestas tardías: cada recarga abre una "generación" nueva y la
//   respuesta de una generación anterior no toca el estado.
// - Un fallo al pedir la página siguiente conserva lo ya cargado y se puede reintentar.
// El filtro por estado se aplica en la pantalla (el servicio aún no lo ofrece).

type Estado = "cargando" | "listo" | "error";

function fusionar(actuales: PublicacionPropia[], nuevas: PublicacionPropia[]): PublicacionPropia[] {
  const vistos = new Set(actuales.map((p) => p.idPublicacion));
  const agregadas = nuevas.filter((p) => {
    if (vistos.has(p.idPublicacion)) return false;
    vistos.add(p.idPublicacion);
    return true;
  });
  return [...actuales, ...agregadas];
}

export function useMisPublicaciones() {
  const [items, setItems] = useState<PublicacionPropia[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState<string>();
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState<string>();
  const [refrescando, setRefrescando] = useState(false);

  const generacion = useRef(0);
  const cursor = useRef<string | null>(null);
  const pidiendoMas = useRef(false);
  const hayItems = useRef(false);

  const recargar = useCallback(async (silencioso = false) => {
    const esta = ++generacion.current;
    pidiendoMas.current = false;
    setCargandoMas(false);
    setErrorMas(undefined);
    if (silencioso && hayItems.current) setRefrescando(true);
    else setEstado("cargando");

    const resultado = await listarMisPublicaciones();
    if (esta !== generacion.current) return; // llegó tarde: otra recarga ya está en curso
    setRefrescando(false);

    if (!resultado.exito) {
      // Con una lista ya visible, un fallo al refrescar no la borra.
      if (!(silencioso && hayItems.current)) {
        setEstado("error");
        setError(mensajeDeError(resultado));
      }
      return;
    }
    cursor.current = resultado.datos.siguienteCursor;
    hayItems.current = true;
    setItems(fusionar([], resultado.datos.items));
    setHayMas(resultado.datos.siguienteCursor !== null);
    setError(undefined);
    setEstado("listo");
  }, []);

  const cargarMas = useCallback(async () => {
    if (pidiendoMas.current || cursor.current === null) return;
    pidiendoMas.current = true;
    setCargandoMas(true);
    setErrorMas(undefined);
    const esta = generacion.current;

    const resultado = await listarMisPublicaciones({ cursor: cursor.current });
    if (esta !== generacion.current) return;
    pidiendoMas.current = false;
    setCargandoMas(false);

    if (!resultado.exito) {
      setErrorMas(mensajeDeError(resultado));
      return;
    }
    cursor.current = resultado.datos.siguienteCursor;
    setItems((actuales) => fusionar(actuales, resultado.datos.items));
    setHayMas(resultado.datos.siguienteCursor !== null);
  }, []);

  /** Reemplaza una publicación ya cargada (p. ej. tras cerrarla). */
  const actualizar = useCallback((publicacion: PublicacionPropia) => {
    setItems((actuales) =>
      actuales.map((p) => (p.idPublicacion === publicacion.idPublicacion ? publicacion : p)),
    );
  }, []);

  useEffect(() => {
    recargar();
    return () => {
      generacion.current += 1; // al salir, ninguna respuesta pendiente toca el estado
    };
  }, [recargar]);

  return {
    items,
    hayMas,
    estado,
    error,
    cargandoMas,
    errorMas,
    refrescando,
    recargar,
    cargarMas,
    actualizar,
  };
}
