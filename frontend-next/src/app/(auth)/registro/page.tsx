import type { Metadata } from "next";
import AuthScreen from "@/features/auth/AuthScreen";
import { authConfig } from "@/lib/auth/gateway";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Crear cuenta | ¿Hay cupo?" };

export default function RegisterPage() {
  return <AuthScreen mode="register" passwordMinimum={authConfig()?.provider === "supabase" ? 8 : 6} />;
}
