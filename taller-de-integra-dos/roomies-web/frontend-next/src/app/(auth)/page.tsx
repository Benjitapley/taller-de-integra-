import type { Metadata } from "next";
import AuthScreen from "@/features/auth/AuthScreen";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth/gateway";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Acceso | ¿Hay cupo?" };

export default async function AccessPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const config = authConfig();
  // Compatibilidad con Site URL existente: el código llega al BFF, nunca a JS.
  if (config?.provider === "supabase" && typeof query.code === "string" && /^[A-Za-z0-9_-]{10,512}$/.test(query.code)) {
    const jar = await cookies();
    const recoveryName = config.secure ? "__Host-roomies_recovery_pkce" : "roomies_recovery_pkce_dev";
    const action = jar.has(recoveryName) ? "recuperacion-callback" : "confirmar";
    redirect(`/web-api/auth/${action}?code=${encodeURIComponent(query.code)}`);
  }
  const notice = query.correo === "verificado" ? "Correo verificado correctamente. Ya puedes iniciar sesión." + (query.perfil === "pendiente" ? " No se pudo preparar tu perfil; al iniciar sesión se intentará nuevamente." : "") : query.error ? "El enlace no es válido o ha expirado. Solicita uno nuevo." : "";
  return <AuthScreen mode="login" notice={notice} supabaseAuth={config?.provider === "supabase"} />;
}
