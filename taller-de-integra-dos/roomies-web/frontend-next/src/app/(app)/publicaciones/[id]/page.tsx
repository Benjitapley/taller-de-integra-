import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { authConfig, readToken } from "@/lib/auth/gateway";
import { publicImageURL } from "@/features/publicaciones/contracts";
import styles from "@/features/publicaciones/publicaciones.module.css";
import ClosePublicationButton from "@/features/publicaciones/ClosePublicationButton";
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
  // id_arriendo is present only in the owner's canonical detail, including null.
  const isOwner = publication !== null && "id_arriendo" in publication;
  const price = typeof publication?.precio === "number" && Number.isSafeInteger(publication.precio) && publication.precio >= 0 && publication.precio <= 999999999999
    ? new Intl.NumberFormat("es-CL").format(publication.precio) + " CLP" : "Precio por confirmar";
  return <main>
    <Link href="/inicio" className={styles.breadcrumb}>‹ Volver a publicaciones <span>/ Detalle</span></Link>
    {publication ? <div className={styles.detailGrid}>
      <article className={styles.detailCard}>
        {images[0] && <Image className={styles.hero} src={images[0].url} width={754} height={317} alt="Fotografía de la publicación" unoptimized />}
        <div className={styles.detailBody}>
          <div className={styles.chips}><span className={styles.chip}>⌂ Arriendo</span>
            <span className={`${styles.status} ${publication.estado === "Disponible" ? styles.available : publication.estado === "Cerrada" ? styles.closed : ""}`}>{text("estado")}</span></div>
          <h1>{text("titulo")}</h1>
          <strong className={styles.price}>{price}</strong>
          <div className={styles.capacity}><span>{text("cupos_disponibles")} de {text("cupos_totales")} cupos disponibles</span><span>⌖ {placeNames.join(", ") || text("ubicacion")}</span></div>
          <p>Vivienda: {text("tipo_vivienda")} · Mascotas: {text("mascota")}</p>
          <h2>Descripción</h2><p className={styles.description}>{text("descripcion")}</p>
          {visibleRules.length > 0 && <section><h2>Reglas del arrendador</h2><ul>{visibleRules.map((rule, index) => <li key={index}>{rule}</li>)}</ul></section>}
          {images.length > 1 && <div className={styles.imageGrid}>{images.slice(1).map(image => <Image key={image.id_imagen} src={image.url} width={120} height={90} alt="Fotografía de la publicación" unoptimized />)}</div>}
          {authorName && <section><h2>Publicado por</h2><div className={styles.author}>
            {authorPhoto ? <Image src={authorPhoto} width={44} height={44} alt="" unoptimized /> : <span className={styles.authorInitial} aria-hidden="true">{authorName.slice(0, 1).toUpperCase()}</span>}<div><strong>{authorName}</strong><p>Arrendador</p></div>
          </div></section>}
          {published && Number.isFinite(published.getTime()) && <p><time dateTime={published.toISOString()}>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(published)}</time></p>}
        </div>
      </article>
      <aside className={styles.detailAside} aria-label="Acciones de la publicación">
        <h2>{isOwner ? "Tu publicación" : "¿Te interesa este arriendo?"}</h2>
        <strong className={styles.price}>{price}</strong>
        <p>{text("cupos_disponibles")} cupos disponibles · {placeNames[0] || text("ubicacion")}</p>
        {isOwner ? <><Link className={styles.actionLink} href={`/editar-publicacion?id=${id}`}>Editar publicación</Link>
          {publication.estado !== "Cerrada" && <ClosePublicationButton id={Number(id)} />}</> :
          config?.provider === "supabase" && publication.tipo === "Arrendador" && ["Disponible", "Activa"].includes(String(publication.estado)) &&
          typeof publication.cupos_disponibles === "number" && publication.cupos_disponibles > 0 &&
          (!applicationState || applicationState === "Cancelada") && <PostulateButton id={Number(id)} />}
        {applicationState && <p>Tu postulación: {applicationState}</p>}
        {publication.estado === "Cerrada" && <p>Este aviso está cerrado y no recibe postulaciones.</p>}
        {reportsEnabled(config) && !isOwner && <Link href={`/mis-reportes?publicacion=${id}`}>Reportar publicación</Link>}
      </aside>
    </div> : <p role="alert">No se pudo cargar esta publicación. Vuelve a intentarlo desde Inicio.</p>}
  </main>;
}
