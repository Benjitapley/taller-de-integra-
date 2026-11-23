"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { routes } from "@/config/navigation";
import { apiRequest, type ApiPath } from "@/lib/api/client";
import { publicationPage, appendPublications, type Publication } from "../publicaciones/contracts";
import styles from "./inicio.module.css";

const items = [{ value: "arriendos", label: "ARRIENDOS" }, { value: "personas", label: "PERSONAS" }] as const;
type SearchFilters = {
  consulta: string;
  precio_min: string;
  precio_max: string;
  cupos_disponibles: string;
  categoria: string;
  tipo_vivienda: string;
  mascota: string;
  presupuesto_max: string;
  ocupacion: string;
};
type Person = {
  id_usuario_PK: number;
  nombre: string;
  presupuesto: number | null;
  zona_interes: string | null;
  ocupacion: string | null;
};

const emptyFilters: SearchFilters = {
  consulta: "", precio_min: "", precio_max: "", cupos_disponibles: "", categoria: "",
  tipo_vivienda: "", mascota: "", presupuesto_max: "", ocupacion: "",
};

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("La API devolvió una respuesta no válida.");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("La API devolvió un resultado no válido.");
    return item as Record<string, unknown>;
  });
}

function people(value: unknown): Person[] {
  return records(value).map((item) => {
    if (!Number.isSafeInteger(item.id_usuario_PK) || typeof item.nombre !== "string") {
      throw new Error("La API devolvió un perfil no válido.");
    }
    return {
      id_usuario_PK: item.id_usuario_PK as number, nombre: item.nombre,
      presupuesto: typeof item.presupuesto === "number" ? item.presupuesto : null,
      zona_interes: typeof item.zona_interes === "string" ? item.zona_interes : null,
      ocupacion: typeof item.ocupacion === "string" ? item.ocupacion : null,
    };
  });
}

function price(value: number | string) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 2 }).format(Number(value));
}

export default function HomeContent({ canReport = false }: { canReport?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const value = params.get("vista") === "personas" ? "personas" : "arriendos";
  const isPeople = value === "personas";
  const loadingMoreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [sending, setSending] = useState<number | null>(null);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [results, setResults] = useState<{
    key: string;
    listings: Publication[];
    profiles: Person[];
    error: string;
    moreError: string;
    cursor: string | null;
  } | null>(null);
  const requestKey = JSON.stringify([isPeople, applied, retry]);
  const currentResults = results?.key === requestKey ? results : null;
  const loading = currentResults === null;
  const error = currentResults?.error ?? "";
  const listings = currentResults?.listings ?? [];
  const profiles = currentResults?.profiles ?? [];

  useEffect(() => {
    if (results?.key === requestKey) return;
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (isPeople) {
      if (applied.consulta.trim()) query.set("zona", applied.consulta.trim());
      if (applied.presupuesto_max) query.set("presupuesto_max", applied.presupuesto_max);
      if (applied.ocupacion) query.set("ocupacion", applied.ocupacion);
    } else {
      for (const key of ["consulta", "precio_min", "precio_max", "cupos_disponibles", "categoria", "tipo_vivienda", "mascota"] as const) {
        const field = key === "consulta" ? applied.consulta : applied[key];
        if (field) query.set(key, field);
      }
    }
    const suffix: "" | `?${string}` = query.size ? `?${query.toString()}` : "";
    const path: ApiPath = isPeople
      ? `/web-api/conexiones/personas${suffix}`
      : `/api/publicaciones${suffix}`;
    apiRequest<unknown>(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then((result) => {
        if (controller.signal.aborted) return;
        setResults({
          key: requestKey,
          listings: isPeople ? [] : publicationPage(result).items,
          cursor: isPeople ? null : publicationPage(result).siguiente_cursor,
          profiles: isPeople ? people(result) : [],
          error: "",
          moreError: "",
        });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setResults({
          key: requestKey,
          listings: [],
          cursor: null,
          profiles: [],
          error: reason instanceof Error ? reason.message : "No se pudo cargar el listado.",
          moreError: "",
        });
      });
    return () => controller.abort();
  }, [applied, isPeople, requestKey, results?.key]);

  async function loadMore() {
    if (loadingMoreRef.current || !currentResults?.cursor) return;
    const key = requestKey;
    const cursor = currentResults.cursor;
    loadingMoreRef.current = true; setLoadingMore(true);
    const query = new URLSearchParams({ cursor });
    for (const field of ["consulta", "precio_min", "precio_max", "cupos_disponibles", "categoria", "tipo_vivienda", "mascota"] as const) {
      if (applied[field]) query.set(field, applied[field]);
    }
    try {
      const page = publicationPage(await apiRequest(`/api/publicaciones?${query}`));
      setResults(current => current?.key === key ? { ...current, listings: appendPublications(current.listings, page.items), cursor: page.siguiente_cursor, moreError: "" } : current);
    } catch {
      setResults(current => current?.key === key ? { ...current, moreError: "No se pudo cargar la siguiente página. Puedes reintentar." } : current);
    } finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
  }

  async function connect(id: number) {
    if (sending !== null) return;
    setSending(id); setConnectionMessage("");
    try {
      const response = await fetch("/web-api/conexiones", { method: "POST", headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" }, body: JSON.stringify({ id_receptor_FK: id }) });
      if (response.status === 401) { router.replace("/"); return; }
      setConnectionMessage(response.ok ? "Solicitud enviada. Puedes consultarla en Mis conexiones." : "No se pudo enviar la solicitud. Revisa si ya existe una conexión con esta persona.");
    } catch { setConnectionMessage("No se pudo confirmar la solicitud. Revisa Mis conexiones antes de volver a intentarlo."); }
    finally { setSending(null); }
  }

  return <Tabs items={items} value={value} label="Tipo de búsqueda" onChange={(next) => {
    const query = new URLSearchParams(params.toString());
    query.set("vista", next);
    router.push(`${routes.home}?${query}`, { scroll: false });
  }}>
    <form className={styles.searchForm} onSubmit={search}>
      <label className={styles.search} aria-label="Buscar publicaciones y personas">
        <Icon name="search" size={22} />
        <input aria-label={isPeople ? "Buscar por comuna o zona" : "Buscar por título, comuna o descripción"} value={filters.consulta}
          onChange={(event) => setFilters({ ...filters, consulta: event.target.value })} maxLength={250}
          placeholder={isPeople ? "Comuna o zona de interés..." : "Comuna, sector o palabra clave..."} />
      </label>
      <div className={styles.filterGrid}>
        {isPeople ? <>
          <label>Presupuesto máximo (CLP)<input type="number" min="0" max="2147483647" value={filters.presupuesto_max}
            onChange={(event) => setFilters({ ...filters, presupuesto_max: event.target.value })} /></label>
          <label>Ocupación<select value={filters.ocupacion} onChange={(event) => setFilters({ ...filters, ocupacion: event.target.value })}>
            <option value="">Todas</option><option>Estudiante</option><option>Trabajador</option><option>Ambos</option>
          </select></label>
        </> : <>
          <label>Precio mínimo (CLP)<input type="number" min="0" step="1" value={filters.precio_min}
            onChange={(event) => setFilters({ ...filters, precio_min: event.target.value })} /></label>
          <label>Precio máximo (CLP)<input type="number" min="0" step="1" value={filters.precio_max}
            onChange={(event) => setFilters({ ...filters, precio_max: event.target.value })} /></label>
          <label>Cupos<select value={filters.cupos_disponibles} onChange={(event) => setFilters({ ...filters, cupos_disponibles: event.target.value })}>
            <option value="">Cualquier cantidad</option><option value="1">Exactamente 1</option><option value="2">Exactamente 2</option><option value="3">Exactamente 3</option><option value="4">Exactamente 4</option>
          </select></label>
          <label>Publicación<select value={filters.categoria} onChange={(event) => setFilters({ ...filters, categoria: event.target.value })}>
            <option value="">Todas</option><option value="busco">Busca arriendo</option><option value="ofrezco">Ofrece arriendo</option>
          </select></label>
          <label>Vivienda<select value={filters.tipo_vivienda} onChange={(event) => setFilters({ ...filters, tipo_vivienda: event.target.value })}>
            <option value="">Todos los tipos</option><option value="casa">Casa</option><option value="departamento">Departamento</option><option value="habitacion">Habitación</option>
          </select></label>
          <label>Mascotas<select value={filters.mascota} onChange={(event) => setFilters({ ...filters, mascota: event.target.value })}>
            <option value="">Indiferente</option><option value="si">Acepta</option><option value="no">No acepta</option>
          </select></label>
        </>}
      </div>
      <div className={styles.filterActions}><Button type="submit">{loading ? "Buscando…" : "Buscar"}</Button>
        <Button type="button" variant="secondary" onClick={clearFilters}>Limpiar filtros</Button></div>
    </form>

    <div className={styles.sectionHeading}><h2>{isPeople ? "Encuentra roomies" : "Publicaciones recientes"}</h2>
      {!loading && !error && <small>{isPeople ? profiles.length : listings.length} resultados</small>}</div>
    {loading && <p role="status">Cargando resultados…</p>}
    {error && <p className={styles.error} role="alert">{error} <Button onClick={() => currentResults?.cursor ? void loadMore() : setRetry(value => value + 1)}>Reintentar</Button></p>}
    {connectionMessage && <p role="status">{connectionMessage} <Link href="/mis-conexiones">Ver conexiones</Link></p>}
    {!loading && !error && isPeople && (profiles.length
      ? <div className={styles.results}>{profiles.map((person) => <article className={styles.resultCard} key={person.id_usuario_PK}>
        <span className={styles.avatar}>{person.nombre.trim().slice(0, 1).toUpperCase() || "?"}</span>
        <div><h3>{person.nombre}</h3><p>{person.ocupacion || "Ocupación no informada"}</p>
          <small>{person.zona_interes || "Zona no informada"}{person.presupuesto !== null ? ` · Presupuesto ${price(person.presupuesto)}` : ""}</small></div>
        <div>
          <Button disabled={sending !== null} onClick={() => void connect(person.id_usuario_PK)}>{sending === person.id_usuario_PK ? "Enviando…" : "Conectar"}</Button>
          {canReport && <p><Link href={`/mis-reportes?usuario=${person.id_usuario_PK}`} aria-label={`Reportar a ${person.nombre}`}>Reportar</Link></p>}
        </div>
      </article>)}</div>
      : <EmptyState icon="user" title="No hay personas para estos filtros" description="Prueba con otra comuna, presupuesto u ocupación." />)}
    {!loading && !isPeople && (listings.length
      ? <div className={styles.results}>{listings.map((publication) => <article className={styles.resultCard} key={publication.id_publicacion}>
        {publication.imagenes[0]?.url && <Image className={styles.publicationImage} src={publication.imagenes[0].url} alt="" width={180} height={140} unoptimized />}
        <div className={styles.publicationDetails}><p className={styles.badge}>{publication.categoria === "busco" ? "Busca arriendo" : "Ofrece arriendo"}</p>
          <h3><Link href={`/publicaciones/${publication.id_publicacion}`}>{publication.titulo}</Link></h3><p>{publication.ubicacion}</p><strong>{price(publication.precio)}</strong>
          <small>{publication.tipo ?? "Publicación"} · {publication.tipo_vivienda || "Vivienda sin especificar"} · {publication.cupos_disponibles ?? "Por confirmar"} cupos disponibles · Mascotas: {publication.mascota === "si" ? "sí" : "no"}</small>
          {publication.descripcion && <p className={styles.description}>{publication.descripcion}</p>}</div>
      </article>)}</div>
      : !error && <EmptyState icon="home" title="No hay publicaciones para estos filtros" description="Prueba con otros términos o amplía los filtros de precio y vivienda." />)}
    {!isPeople && currentResults?.moreError && <p role="alert">{currentResults.moreError}</p>}
    {!isPeople && currentResults?.cursor && <Button disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Cargando..." : "Cargar más"}</Button>}
    {!isPeople && !loading && !currentResults?.cursor && listings.length > 0 && <p role="status">No hay más publicaciones.</p>}
  </Tabs>;
}
