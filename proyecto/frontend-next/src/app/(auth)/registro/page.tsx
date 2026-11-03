import type { Metadata } from "next";
import AuthScreen from "@/features/auth/AuthScreen";

export const metadata: Metadata = { title: "Crear cuenta | ¿Hay cupo?" };

export default function RegisterPage() {
  return <AuthScreen mode="register" />;
}
