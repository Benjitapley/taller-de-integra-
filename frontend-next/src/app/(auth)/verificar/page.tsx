import type { Metadata } from "next";
import AuthScreen from "@/features/auth/AuthScreen";

export const metadata: Metadata = { title: "Verificar correo | ¿Hay cupo?" };

export default function VerificationPage() {
  return <AuthScreen mode="verify" />;
}
