import Link from "next/link";
import Image from "next/image";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import { headers } from "next/headers";
import { authConfig, readToken } from "@/lib/auth/gateway";
import { publicImageURL } from "@/features/publicaciones/contracts";
import PostulateButton from "@/features/publicaciones/PostulateButton";
import { reportsEnabled } from "@/lib/reportes";

export default async function PublicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = authConfig();
  let publication: Record<string, unknown> | null = null;
  if (config && /^[1-9]\d{0,9}$/.test(id)) {
    try {
      const token = readToken((await headers()).get("cookie"), config);
      const response = await fetch(`${config.backend}/api/publicaciones/${id}`, {
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      });
      if (response.ok) {
        const body: unknown = await response.json();
        if (body && typeof body === "object" && "id_publicacion" in body && body.id_publicacion === Number(id)) publication = body as Record<string, unknown>;
      }
    } catch { /* El error se muestra sin datos internos del servicio. */ }
  }
  const text = (field: string) => typeof publication?.[field] === "string" || typeof publication?.[field] === "number" ? String(publication[field]) : "Por confirmar";
  const images = Array.isArray(publication?.imagenes) ? publication.imagenes.filter(item => item && publicImageURL(item.url)) : [];
  const rules = publication?.reglas_arrendador ?? publication?.reglas;
  const visibleRules = Array.isArray(rules) ? rules.filter((rule): rule is string => typeof rule === "string") : [];
  const author = publication?.autor;
  const authorName = author && typeof author === "object" && "nombre" in author && typeof author.nombre === "string" ? author.nombre : null;
  const authorPhoto = author && typeof author === "object" && "foto" in author ? publicImageURL(author.foto) : null;
  const placeNames = [publication?.comuna, publication?.region].flatMap(place =>
    place && typeof place === "object" && "nombre" in place && typeof place.nombre === "string" ? [place.nombre] : []);
  const application = publication?.mi_postulacion;
  const applicationState = application && typeof application === "object" && "estado" in application &&
    typeof application.estado === "string" ? application.estado : null;
  const published = typeof publication?.fecha_publicacion === "string" ? new Date(publication.fecha_publicacion) : null;
  return <main>
    <PageHeader title="Detalle de publicación" description="Consulta las características y el estado del aviso." />
    <Card>{publication ? <>
      <h2>{text("titulo")}</h2><p>{text("tipo")} · {text("estado")}</p>
      {images.map(image => <Image key={image.id_imagen} src={image.url} width={640} height={400} alt="Fotografía de la publicación" unoptimized style={{ maxWidth: "100%", height: "auto", borderRadius: 12 }} />)}
      {authorName && <p>{authorPhoto && <Image src={authorPhoto} width={40} height={40} alt="" unoptimized />} Publicado por {authorName}</p>}
      {published && Number.isFinite(published.getTime()) && <p><time dateTime={published.toISOString()}>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(published)}</time></p>}
      <p>{[...new Set([text("ubicacion"), placeNames.join(", ")].filter(Boolean))].join(" · ")}</p><p>Precio: {text("precio")} CLP</p>
      <p>Cupos disponibles: {text("cupos_disponibles")} · Capacidad total: {text("cupos_totales")}</p>
      <p>Vivienda: {text("tipo_vivienda")} · Mascotas: {text("mascota")}</p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text("descripcion")}</p>
      {visibleRules.length > 0 && <section><h3>Reglas del arriendo</h3><ul>{visibleRules.map((rule, index) => <li key={index}>{rule}</li>)}</ul></section>}
      {applicationState && <p>Tu postulación: {applicationState}</p>}
      {config?.provider === "supabase" && publication.tipo === "Arrendador" && publication.estado !== "Cerrada" &&
        !("id_arriendo" in publication) && typeof publication.cupos_disponibles === "number" && publication.cupos_disponibles > 0 &&
        (!applicationState || applicationState === "Cancelada") && <PostulateButton id={Number(id)} />}
      {reportsEnabled(config) && <p><Link href={`/mis-reportes?publicacion=${id}`}>Reportar publicación</Link></p>}
    </> : <p role="alert">No se pudo cargar esta publicación. Vuelve a intentarlo desde Inicio.</p>}</Card>
    <p><Link href="/inicio">Volver a Inicio</Link></p>
  </main>;
}
