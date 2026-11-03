import type { Metadata } from "next";
import AuthScreen from "@/features/auth/AuthScreen";

export const metadata: Metadata = { title: "Acceso | ¿Hay cupo?" };

export default function AccessPage() {
  return <AuthScreen mode="login" />;
}
