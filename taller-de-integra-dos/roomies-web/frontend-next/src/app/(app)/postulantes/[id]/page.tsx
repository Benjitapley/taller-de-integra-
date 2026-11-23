import PageHeader from "@/components/layout/PageHeader";
import Applications from "@/features/publicaciones/Applications";
export default async function Applicants({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main><PageHeader title="Postulantes" description="Revisa y decide sobre las postulaciones de tu publicación." />
    {/^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id)) ? <Applications key={id} publication={Number(id)} /> : <p role="alert">Publicación inválida.</p>}</main>;
}
