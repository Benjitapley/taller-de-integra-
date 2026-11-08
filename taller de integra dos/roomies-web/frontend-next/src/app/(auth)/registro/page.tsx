import type { Metadata } from "next";
import AuthScreen from "@/features/auth/AuthScreen";
import { authConfig } from "@/lib/auth/gateway";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Crear cuenta | ¿Hay cupo?" };

export default function RegisterPage() {
  const supabaseAuth = authConfig()?.provider === "supabase";
  return <AuthScreen mode="register" supabaseAuth={supabaseAuth} passwordMinimum={supabaseAuth ? 8 : 6} />;
}
