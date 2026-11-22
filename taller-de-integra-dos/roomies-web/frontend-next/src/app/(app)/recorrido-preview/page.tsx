import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import RecorridoPreview from "@/features/recorrido/RecorridoPreview";

export default function RecorridoPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><PageHeader title="Revisión del recorrido" description="Interfaces de convivencia preparadas según el contrato S3." /><RecorridoPreview /></>;
}
