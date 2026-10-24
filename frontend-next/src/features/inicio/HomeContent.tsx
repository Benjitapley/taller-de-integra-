"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { routes } from "@/config/navigation";
import styles from "./inicio.module.css";

const items = [{ value: "arriendos", label: "ARRIENDOS" }, { value: "personas", label: "PERSONAS" }] as const;

export default function HomeContent() {
  const params = useSearchParams();
  const router = useRouter();
  const value = params.get("vista") === "personas" ? "personas" : "arriendos";
  const people = value === "personas";
  return <Tabs items={items} value={value} label="Tipo de búsqueda" onChange={(next) => {
    const query = new URLSearchParams(params.toString());
    query.set("vista", next);
    router.push(`${routes.home}?${query}`, { scroll: false });
  }}>
    <div className={styles.search} aria-label="Búsqueda pendiente de integración">
      <Icon name="search" size={22} /><input aria-label={people ? "Buscar por nombre o comuna (pendiente)" : "Buscar arriendos (pendiente)"} placeholder={people ? "Nombre o comuna..." : "Comuna, sector o palabra clave..."} disabled /><Button disabled>Buscar</Button>
    </div>
    <div className={styles.filters}><span>{people ? "Edad · Comuna · Ocupación · Calificación" : "Precio · Comuna · Cupos · Tipo de publicación"}</span><span><Icon name="filter" size={18} /> Filtros pendientes</span></div>
    <div className={styles.sectionHeading}><h2>{people ? "Encuentra roomies" : "Publicaciones recientes"}</h2><small>Próximamente</small></div>
    <EmptyState icon={people ? "user" : "home"} title={people ? "Personas: integración pendiente" : "Arriendos: integración pendiente"} description={people ? "Aquí podrás encontrar personas cuando se integre esta sección. No se han consultado perfiles." : "Aquí se mostrarán publicaciones cuando se integre el listado. No se han consultado arriendos."} />
    <p className={styles.integrationNote}>Vista de estructura y navegación. La búsqueda y los filtros aún no están disponibles.</p>
  </Tabs>;
}
