import type { Metadata } from "next";
import PageHeader from "@/components/layout/PageHeader";
import PublicationChooser from "@/features/publicaciones/PublicationChooser";

export const metadata: Metadata = { title: "Publicar | ¿Hay cupo?" };

export default function Publish() {
  return <main>
    <PageHeader title="Publicar" description="Elige cómo quieres compartir una oportunidad con la comunidad." />
    <PublicationChooser />
  </main>;
}
