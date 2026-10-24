import type { Metadata } from "next";
import AccessPlaceholder from "@/features/auth/AccessPlaceholder";

export const metadata: Metadata = { title: "Acceso | ¿Hay cupo?" };

export default function AccessPage() {
  return <AccessPlaceholder />;
}
