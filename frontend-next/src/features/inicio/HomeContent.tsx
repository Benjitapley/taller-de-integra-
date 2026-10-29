"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { routes } from "@/config/navigation";
import styles from "./inicio.module.css";

const items = [{ value: "arriendos", label: "ARRIENDOS" }, { value: "personas", label: "PERSONAS" }] as const;

const listings = [
  { id: 1, title: "Habitación luminosa cerca del metro", location: "Ñuñoa, Santiago", price: 280000, seats: 1, type: "departamento", pets: true, description: "Habitación amoblada en departamento compartido, con gastos comunes incluidos." },
  { id: 2, title: "Casa con patio y espacios compartidos", location: "La Florida, Santiago", price: 220000, seats: 3, type: "casa", pets: true, description: "Ambiente tranquilo, cocina equipada y buena conexión con transporte público." },
  { id: 3, title: "Cupo en departamento céntrico", location: "Centro, Concepción", price: 190000, seats: 1, type: "departamento", pets: false, description: "Espacio disponible en departamento amoblado, a pasos de servicios y universidades." },
] as const;

const profiles = [
  { id: 1, name: "Alex", age: 24, occupation: "Estudiante", location: "Ñuñoa, Santiago", description: "Busco compartir un espacio tranquilo y mantener una buena convivencia." },
  { id: 2, name: "Sam", age: 29, occupation: "Profesional", location: "Centro, Concepción", description: "Trabajo durante la semana y valoro los espacios comunes cuidados." },
  { id: 3, name: "Dani", age: 32, occupation: "Profesional", location: "La Florida, Santiago", description: "Me gustaría encontrar un lugar cómodo para compartir a largo plazo." },
] as const;

const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function HomeContent() {
  const params = useSearchParams();
  const router = useRouter();
  const value = params.get("vista") === "personas" ? "personas" : "arriendos";
  const people = value === "personas";
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [seats, setSeats] = useState("");
  const [type, setType] = useState("");
  const [pets, setPets] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [sort, setSort] = useState("recent");

  const filteredListings = useMemo(() => listings
    .filter((listing) => {
      const search = appliedSearch.trim().toLocaleLowerCase("es");
      return (!search || `${listing.title} ${listing.location} ${listing.description}`.toLocaleLowerCase("es").includes(search))
        && (!seats || (seats === "3" ? listing.seats >= 3 : listing.seats === Number(seats)))
        && (!type || listing.type === type)
        && (!pets || listing.pets === (pets === "si"))
        && (!maxPrice || listing.price <= Number(maxPrice));
    })
    .sort((a, b) => sort === "price" ? a.price - b.price : a.id - b.id), [appliedSearch, seats, type, pets, maxPrice, sort]);

  const filteredProfiles = useMemo(() => profiles.filter((profile) => {
    const search = appliedSearch.trim().toLocaleLowerCase("es");
    const matchesAge = !age || (age === "18-25" ? profile.age <= 25 : age === "26-30" ? profile.age >= 26 && profile.age <= 30 : profile.age > 30);
    return (!search || `${profile.name} ${profile.location} ${profile.description}`.toLocaleLowerCase("es").includes(search))
      && matchesAge
      && (!occupation || profile.occupation.toLowerCase() === occupation);
  }), [appliedSearch, age, occupation]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchText);
  }

  function changeView(next: "arriendos" | "personas") {
    const query = new URLSearchParams(params.toString());
    query.set("vista", next);
    router.push(`${routes.home}?${query}`, { scroll: false });
  }

  function clearFilters() {
    setSearchText("");
    setAppliedSearch("");
    setSeats("");
    setType("");
    setPets("");
    setMaxPrice("");
    setAge("");
    setOccupation("");
    setSort("recent");
  }

  return <Tabs items={items} value={value} label="Tipo de búsqueda" onChange={changeView}>
    <form className={styles.search} onSubmit={search}>
      <Icon name="search" size={22} />
      <input aria-label={people ? "Buscar personas" : "Buscar arriendos"} placeholder={people ? "Nombre o comuna..." : "Comuna, sector o palabra clave..."} value={searchText} onChange={(event) => setSearchText(event.target.value)} />
      <Button type="submit">Buscar</Button>
    </form>

    <section className={styles.filterPanel} aria-label="Filtros de búsqueda">
      <div className={styles.filterHeader}>
        <div><Icon name="filter" size={19} /><h2>Filtros</h2></div>
        <button type="button" className={styles.clearButton} onClick={clearFilters}>Limpiar filtros</button>
      </div>
      <div className={styles.filterGrid}>
        {people ? <>
          <label className={styles.filterField}>Edad
            <select value={age} onChange={(event) => setAge(event.target.value)}>
              <option value="">Cualquier edad</option><option value="18-25">18 a 25 años</option><option value="26-30">26 a 30 años</option><option value="30+">Más de 30 años</option>
            </select>
          </label>
          <label className={styles.filterField}>Ocupación
            <select value={occupation} onChange={(event) => setOccupation(event.target.value)}>
              <option value="">Cualquiera</option><option value="estudiante">Estudiante</option><option value="profesional">Profesional</option>
            </select>
          </label>
        </> : <>
          <label className={styles.filterField}>Cupos disponibles
            <select value={seats} onChange={(event) => setSeats(event.target.value)}>
              <option value="">Cualquier cantidad</option><option value="1">1 cupo</option><option value="2">2 cupos</option><option value="3">3 o más cupos</option>
            </select>
          </label>
          <label className={styles.filterField}>Tipo de vivienda
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Casa o departamento</option><option value="casa">Casa</option><option value="departamento">Departamento</option>
            </select>
          </label>
          <label className={styles.filterField}>Mascotas
            <select value={pets} onChange={(event) => setPets(event.target.value)}>
              <option value="">Indiferente</option><option value="si">Sí acepta</option><option value="no">No acepta</option>
            </select>
          </label>
          <label className={styles.filterField}>Precio máximo
            <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
              <option value="">Sin límite</option><option value="200000">$200.000</option><option value="250000">$250.000</option><option value="300000">$300.000</option>
            </select>
          </label>
        </>}
      </div>
    </section>

    <div className={styles.sectionHeading}>
      <div><h2>{people ? "Personas que buscan roomie" : "Publicaciones recientes"}</h2><p>{people ? "Conoce a quienes buscan compartir un hogar." : "Encuentra un espacio que se ajuste a ti."}</p></div>
      {!people && <label className={styles.sortField}>Ordenar por
        <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Más recientes</option><option value="price">Menor precio</option></select>
      </label>}
    </div>
    <p className={styles.demoNote}>Vista previa · Contenido de ejemplo, aún no conectado a publicaciones reales.</p>

    {people ? filteredProfiles.length ? <div className={styles.listingGrid}>
      {filteredProfiles.map((profile) => <article className={styles.profileCard} key={profile.id}>
        <div className={styles.profileAvatar} aria-hidden="true">{profile.name[0]}</div>
        <div className={styles.cardContent}>
          <span className={styles.demoBadge}>Ejemplo</span>
          <h3>{profile.name}, {profile.age}</h3>
          <p className={styles.location}><Icon name="user" size={16} />{profile.occupation} · {profile.location}</p>
          <p className={styles.description}>{profile.description}</p>
        </div>
      </article>)}
    </div> : <EmptyState icon="user" title="No encontramos personas" description="Prueba con otros términos o quita algunos filtros." /> : filteredListings.length ? <div className={styles.listingGrid}>
      {filteredListings.map((listing) => <article className={styles.listingCard} key={listing.id}>
        <div className={styles.cardVisual}><Icon name="home" size={42} /><span>Espacio compartido</span><span className={styles.demoBadge}>Ejemplo</span></div>
        <div className={styles.cardContent}>
          <div className={styles.cardEyebrow}>Arriendo · {listing.type === "casa" ? "Casa" : "Departamento"}</div>
          <h3>{listing.title}</h3>
          <p className={styles.location}><Icon name="search" size={16} />{listing.location}</p>
          <p className={styles.description}>{listing.description}</p>
          <div className={styles.cardFooter}><strong>{currency.format(listing.price)}<span> / mes</span></strong><span>{listing.seats} {listing.seats === 1 ? "cupo" : "cupos"}</span></div>
          <div className={styles.tags}><span>{listing.pets ? "🐾 Acepta mascotas" : "Sin mascotas"}</span></div>
        </div>
      </article>)}
    </div> : <EmptyState icon="home" title="No encontramos publicaciones" description="Prueba con otra búsqueda o quita algunos filtros." />}
  </Tabs>;
}
