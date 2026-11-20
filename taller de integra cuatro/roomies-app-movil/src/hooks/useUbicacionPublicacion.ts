import { useCallback, useEffect, useMemo, useState } from "react";
import { REGION_INICIAL } from "@/constants/contratoPublicacion";
import {
  buscarRegionPorNombre,
  obtenerComunas,
  obtenerRegiones,
  type Comuna,
  type Region,
} from "@/services/regionesService";

interface Args {
  idRegion: string;
  idComuna: string;
  /** Fija región y comuna en el formulario (ids y nombres). */
  onFijar: (
    cambios: {
      idRegion?: string;
      nombreRegion?: string;
      idComuna?: string;
      nombreComuna?: string;
    },
    /** true cuando lo decide el hook (región inicial, comuna descartada), no la persona. */
    automatico?: boolean,
  ) => void;
  /** No consulta hasta que el borrador guardado se haya aplicado al formulario. */
  activo: boolean;
}

type Carga<T> = { clave: string; datos?: T[]; error?: string };

// Carga el catálogo de TI2 (regiones y comunas de la región elegida). Si el
// formulario no trae región, parte en La Araucanía. Si la comuna guardada no
// pertenece a la región, se limpia en vez de enviarla.
//
// El estado de carga se deriva de "¿ya llegó la respuesta de la clave actual?": así
// ninguna respuesta tardía de otra región o de un intento anterior pisa a la vigente.
export function useUbicacionPublicacion({ idRegion, idComuna, onFijar, activo }: Args) {
  const [intentoRegiones, setIntentoRegiones] = useState(0);
  const [intentoComunas, setIntentoComunas] = useState(0);
  const [cargaRegiones, setCargaRegiones] = useState<Carga<Region> | null>(null);
  const [cargaComunas, setCargaComunas] = useState<Carga<Comuna> | null>(null);

  const claveRegiones = `r${intentoRegiones}`;
  const claveComunas = `${idRegion}:${intentoComunas}`;

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    obtenerRegiones().then((resultado) => {
      if (!vigente) return;
      setCargaRegiones(
        resultado.exito
          ? { clave: claveRegiones, datos: resultado.datos }
          : { clave: claveRegiones, error: "No pudimos cargar las regiones." },
      );
    });
    return () => {
      vigente = false;
    };
  }, [activo, claveRegiones]);

  useEffect(() => {
    const region = Number(idRegion);
    if (!activo || !idRegion || !Number.isSafeInteger(region)) return;
    let vigente = true;
    obtenerComunas(region).then((resultado) => {
      if (!vigente) return;
      setCargaComunas(
        resultado.exito
          ? { clave: claveComunas, datos: resultado.datos }
          : { clave: claveComunas, error: "No pudimos cargar las comunas." },
      );
    });
    return () => {
      vigente = false;
    };
  }, [activo, idRegion, claveComunas]);

  const regionesActuales = cargaRegiones?.clave === claveRegiones ? cargaRegiones : null;
  const comunasActuales = idRegion && cargaComunas?.clave === claveComunas ? cargaComunas : null;
  const regiones = useMemo(() => regionesActuales?.datos ?? [], [regionesActuales]);
  const comunas = useMemo(() => comunasActuales?.datos ?? [], [comunasActuales]);

  // Sin región elegida, parte en La Araucanía.
  const inicial = useMemo(() => buscarRegionPorNombre(regiones, REGION_INICIAL), [regiones]);
  useEffect(() => {
    if (activo && !idRegion && inicial) {
      onFijar({ idRegion: String(inicial.idRegion), nombreRegion: inicial.nombre }, true);
    }
  }, [activo, idRegion, inicial, onFijar]);

  // Una comuna guardada que no pertenece a la región cargada se descarta.
  useEffect(() => {
    if (idComuna && comunasActuales?.datos && !comunasActuales.datos.some((c) => String(c.idComuna) === idComuna)) {
      onFijar({ idComuna: "", nombreComuna: "" }, true);
    }
  }, [idComuna, comunasActuales, onFijar]);

  const elegirRegion = useCallback(
    (id: number, nombre: string) => {
      if (String(id) === idRegion) return;
      // Cambiar de región invalida la comuna anterior.
      onFijar({ idRegion: String(id), nombreRegion: nombre, idComuna: "", nombreComuna: "" });
    },
    [idRegion, onFijar],
  );

  const elegirComuna = useCallback(
    (id: number, nombre: string) => onFijar({ idComuna: String(id), nombreComuna: nombre }),
    [onFijar],
  );

  const sinInicial =
    !!regionesActuales?.datos && !idRegion && !inicial
      ? `No encontramos ${REGION_INICIAL} en el catálogo; elige una región.`
      : undefined;

  return {
    regiones,
    comunas,
    cargandoRegiones: activo && !regionesActuales,
    cargandoComunas: activo && !!idRegion && !comunasActuales,
    errorRegiones: regionesActuales?.error ?? sinInicial,
    errorComunas: comunasActuales?.error,
    reintentarRegiones: () => setIntentoRegiones((n) => n + 1),
    reintentarComunas: () => setIntentoComunas((n) => n + 1),
    elegirRegion,
    elegirComuna,
  };
}
