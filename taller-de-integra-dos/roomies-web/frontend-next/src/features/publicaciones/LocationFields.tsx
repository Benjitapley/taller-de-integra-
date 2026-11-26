"use client";

import { useEffect, useState } from "react";

type Region = { id_region: number; nombre: string };
type Commune = { id_comuna: number; id_region?: number; nombre: string };

function useAraucaniaCatalog() {
  const [region, setRegion] = useState<Region | null>(null);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
        const response = await fetch("/api/regiones", { signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const regions: unknown = await response.json();
        if (!Array.isArray(regions)) throw new Error();
        const araucania: Region | undefined = regions.find(item => item && Number.isSafeInteger(item.id_region) && typeof item.nombre === "string" && /araucan[ií]a/i.test(item.nombre));
        if (!araucania) throw new Error();
        const result = await fetch(`/api/regiones/${araucania.id_region}/comunas`, { signal, cache: "no-store" });
        if (!result.ok) throw new Error();
        const values: unknown = await result.json();
        if (!Array.isArray(values) || !values.length || values.some(item => !item || !Number.isSafeInteger(item.id_comuna) || item.id_comuna < 1 || (item.id_region !== undefined && item.id_region !== araucania.id_region) || typeof item.nombre !== "string")) throw new Error();
        if (!controller.signal.aborted) { setRegion(araucania); setCommunes(values); setError(""); }
      } catch { if (!controller.signal.aborted) setError("No se pudieron cargar las comunas. Intenta nuevamente."); }
    }
    void load();
    return () => controller.abort();
  }, [retry]);
  return { region, communes, error, retryLoad: () => { setError(""); setRetry(value => value + 1); } };
}

export default function LocationFields({ initialRegion, initialCommune }: { initialRegion?: number; initialCommune?: number }) {
  const { region, communes, error, retryLoad } = useAraucaniaCatalog();
  const [selected, setSelected] = useState("");
  return <>
    <input name="id_region" type="hidden" value={selected ? region?.id_region ?? "" : initialRegion ?? region?.id_region ?? ""} />
    <input name="id_comuna" type="hidden" value={selected || initialCommune || ""} />
    <label>Región
      <input value={region?.nombre ?? "La Araucanía"} readOnly />
    </label>
    <label>Comuna de La Araucanía
      <select data-publication-commune required={!initialCommune} disabled={!region} value={selected || (initialRegion === region?.id_region ? initialCommune ?? "" : "")} onChange={event => setSelected(event.target.value)}>
        <option value="">{initialCommune ? "Conservar comuna actual" : "Selecciona una comuna"}</option>
        {communes.map(item => <option value={item.id_comuna} key={item.id_comuna}>{item.nombre}</option>)}
      </select>
    </label>
    {initialRegion && region && initialRegion !== region.id_region && <p>El aviso conserva su ubicación nacional hasta que selecciones una comuna para actualizarlo.</p>}
    {!region && !error && <p role="status">Cargando comunas…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={retryLoad}>Reintentar</button></p>}
  </>;
}

export function CatalogLocationFilters({ regionId, communeId, onChange }: {
  regionId: string;
  communeId: string;
  onChange: (region: string, commune: string) => void;
}) {
  const { region, communes, error, retryLoad } = useAraucaniaCatalog();
  useEffect(() => {
    if (region && regionId !== String(region.id_region)) onChange(String(region.id_region), "");
  }, [region, regionId, onChange]);
  return <>
    <label>Región para buscar
      <select value={region?.id_region ?? ""} disabled={!region} onChange={event => onChange(event.target.value, "")}>
        {!region && <option value="">Cargando La Araucanía…</option>}
        {region && <option value={region.id_region}>{region.nombre}</option>}
      </select>
    </label>
    <label>Comuna para buscar
      <select value={communeId} disabled={!regionId || !region} onChange={event => onChange(regionId, event.target.value)}>
        <option value="">Todas las comunas de la región</option>
        {communes.map(item => <option value={item.id_comuna} key={item.id_comuna}>{item.nombre}</option>)}
      </select>
    </label>
    {error && <p role="alert">{error} <button type="button" onClick={retryLoad}>Reintentar comunas</button></p>}
  </>;
}
