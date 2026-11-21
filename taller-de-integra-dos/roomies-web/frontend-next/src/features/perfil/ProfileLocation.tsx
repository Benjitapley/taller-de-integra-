"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { Profile } from "./contracts";

type Region = { id_region: number; nombre: string };
type Commune = { id_comuna: number; nombre: string };

function Communes({ region, original }: { region: number; original: number | null }) {
  const [options, setOptions] = useState<Commune[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [commune, setCommune] = useState(original);
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<Commune[]>(`/api/regiones/${region}/comunas`, { signal: abort.signal })
      .then((items) => {
        if (!Array.isArray(items)) throw new Error("Catálogo no disponible");
        if (!abort.signal.aborted) setOptions(items);
      })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [region]);
  return <>
    <label htmlFor="profile-commune">Comuna de interés</label>
    <select id="profile-commune" name="id_comuna_interes" value={commune ?? ""} disabled={!options}
      onChange={(event) => setCommune(event.target.value ? Number(event.target.value) : null)}>
      <option value="">Sin comuna</option>
      {original !== null && !options?.some((commune) => commune.id_comuna === original) &&
        <option value={original}>Comuna actual</option>}
      {options?.map((commune) => <option key={commune.id_comuna} value={commune.id_comuna}>{commune.nombre}</option>)}
    </select>
    {!options && <small role="status">{failed ? "El catálogo de comunas no está disponible." : "Cargando comunas…"}</small>}
  </>;
}

export default function ProfileLocation({ profile }: { profile: Profile }) {
  const original = profile.id_region_interes ?? null;
  const [region, setRegion] = useState(original);
  const [araucania, setAraucania] = useState<Region | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<Region[]>("/api/regiones", { signal: abort.signal })
      .then((regions) => {
        const match = regions?.find(({ nombre }) => /\baraucan[ií]a\b/i.test(nombre));
        if (!match) throw new Error("Región no disponible");
        if (!abort.signal.aborted) setAraucania(match);
      })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, []);
  return <>
    <label htmlFor="profile-region">Región de interés</label>
    <select id="profile-region" name="id_region_interes" value={region ?? ""} disabled={!araucania}
      onChange={(event) => setRegion(event.target.value ? Number(event.target.value) : null)}>
      <option value="">Sin región</option>
      {original !== null && original !== araucania?.id_region && <option value={original}>Región actual</option>}
      {araucania && <option value={araucania.id_region}>{araucania.nombre}</option>}
    </select>
    {!araucania && <small role="status">{failed ? "El catálogo de regiones no está disponible." : "Cargando regiones…"}</small>}
    {araucania && region === araucania.id_region && <Communes key={region} region={region}
      original={region === original ? profile.id_comuna_interes ?? null : null} />}
  </>;
}
