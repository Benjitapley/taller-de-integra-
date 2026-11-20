import Link from "next/link";
import Image from "next/image";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import { authConfig } from "@/lib/auth/gateway";
import { publicImageURL } from "@/features/publicaciones/contracts";
import PostulateButton from "@/features/publicaciones/PostulateButton";

export default async function PublicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = authConfig();
  let publication: Record<string, unknown> | null = null;
  if (config && /^[1-9]\d{0,9}$/.test(id)) {
    try {
      const response = await fetch(`${config.backend}/api/publicaciones/${id}`, {
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const body: unknown = await response.json();
        if (body && typeof body === "object" && "id_publicacion" in body && body.id_publicacion === Number(id)) publication = body as Record<string, unknown>;
      }
    } catch { /* El error se muestra sin datos internos del servicio. */ }
  }
  const text = (field: string) => typeof publication?.[field] === "string" || typeof publication?.[field] === "number" ? String(publication[field]) : "Por confirmar";
  const images = Array.isArray(publication?.imagenes) ? publication.imagenes.filter(item => item && publicImageURL(item.url)) : [];
  return <main>
    <PageHeader title="Detalle de publicación" description="Consulta las características y el estado del aviso." />
    <Card>{publication ? <>
      <h2>{text("titulo")}</h2><p>{text("tipo")} · {text("estado")}</p>
      {images.map(image => <Image key={image.id_imagen} src={image.url} width={640} height={400} alt="Fotografía de la publicación" unoptimized style={{ maxWidth: "100%", height: "auto", borderRadius: 12 }} />)}
      <p>{text("ubicacion")}</p><p>Precio: {text("precio")} CLP</p>
      <p>Cupos disponibles: {text("cupos_disponibles")} · Capacidad total: {text("cupos_totales")}</p>
      <p>Vivienda: {text("tipo_vivienda")} · Mascotas: {text("mascota")}</p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text("descripcion")}</p>
      {config?.provider === "supabase" && publication.tipo === "Arrendador" && publication.estado !== "Cerrada" && <PostulateButton id={Number(id)} />}
    </> : <p role="alert">No se pudo cargar esta publicación. Vuelve a intentarlo desde Inicio.</p>}</Card>
    <p><Link href="/inicio">Volver a Inicio</Link></p>
  </main>;
}
