import { headers } from "next/headers";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { handleRental } from "@/lib/publicaciones/applications";

export default async function MyRental() {
  const cookie = (await headers()).get("cookie");
  const request = new Request("http://localhost/mi-arriendo", { headers: cookie ? { cookie } : undefined });
  const response = await handleRental(request, "mio");
  const rental = response.ok ? await response.json() : null;

  return <main>
    <PageHeader title="Mi arriendo" description="Consulta el arriendo al que perteneces." />
    <Card>
      {rental ? <>
        <h2>{rental.titulo || "Tu arriendo activo"}</h2>
        <Link href={`/publicaciones/${rental.id_publicacion}`}>Ver publicación</Link>
      </> : <p role={response.status === 404 ? "status" : "alert"}>
        {response.status === 404 ? "No se encontró un arriendo activo para tu cuenta."
          : response.status === 401 ? "Inicia sesión nuevamente para consultar tu arriendo."
          : response.status === 403 ? "Tu cuenta no tiene acceso a este arriendo."
          : "No se pudo consultar tu arriendo. Actualiza la página para reintentar."}
      </p>}
      <p><Link href="/mis-postulaciones">Volver a Mis postulaciones</Link></p>
    </Card>
  </main>;
}
