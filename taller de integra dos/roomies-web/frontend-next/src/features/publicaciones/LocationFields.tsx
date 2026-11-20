"use client";

import { useEffect, useState } from "react";

type Region = { id_region: number; nombre: string };
type Commune = { id_comuna: number; id_region: number; nombre: string };

export default function LocationFields({ initialRegion, initialCommune }: { initialRegion?: number; initialCommune?: number }) {
  const [region, setRegion] = useState<Region | null>(null);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/regiones", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const regions: Region[] = await response.json();
        const araucania = regions.find(item => /araucan[ií]a/i.test(item.nombre));
        if (!araucania) throw new Error();
        const result = await fetch(`/api/regiones/${araucania.id_region}/comunas`, { signal: controller.signal, cache: "no-store" });
        if (!result.ok) throw new Error();
        const values: Commune[] = await result.json();
        if (!Array.isArray(values)) throw new Error();
        if (!controller.signal.aborted) { setRegion(araucania); setCommunes(values); setError(""); }
      } catch { if (!controller.signal.aborted) setError("No se pudieron cargar las comunas. Intenta nuevamente."); }
    }
    void load();
    return () => controller.abort();
  }, [retry]);
  return <>
    <input name="id_region" type="hidden" value={selected ? region?.id_region ?? "" : initialRegion ?? region?.id_region ?? ""} />
    <input name="id_comuna" type="hidden" value={selected || initialCommune || ""} />
    <label>Comuna de La Araucanía
      <select required={!initialCommune} disabled={!region} value={selected || (initialRegion === region?.id_region ? initialCommune ?? "" : "")} onChange={event => setSelected(event.target.value)}>
        <option value="">{initialCommune ? "Conservar comuna actual" : "Selecciona una comuna"}</option>
        {communes.map(item => <option value={item.id_comuna} key={item.id_comuna}>{item.nombre}</option>)}
      </select>
    </label>
    {initialRegion && region && initialRegion !== region.id_region && <p>El aviso conserva su ubicación nacional hasta que selecciones una comuna para actualizarlo.</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></p>}
  </>;
}
