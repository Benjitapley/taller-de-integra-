import type { Metadata } from "next";
import AuthScreen from "@/features/auth/AuthScreen";
import { authConfig } from "@/lib/auth/gateway";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verificar correo | ¿Hay cupo?" };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const message = query.estado === "enlace-invalido" ? "El enlace no es válido o ha expirado. Ábrelo en el navegador donde te registraste o solicita uno nuevo." : query.estado === "servicio-no-disponible" ? "No se pudo comprobar el enlace. Intenta nuevamente más tarde." : "";
  return <AuthScreen mode="verify" supabaseVerification={authConfig()?.provider === "supabase"} notice={message} />;
}
