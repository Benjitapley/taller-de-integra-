import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { currentSession, canRenewSession } from "@/lib/auth/server";
import AppShell from "@/components/layout/AppShell";

// Must remain runtime-dependent even when auth is disabled during next build.
export const dynamic = "force-dynamic";

// Each private data operation must also validate its session in the server transport.
export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (session.status === 401 && await canRenewSession()) redirect("/renovar-sesion");
  if ([401, 403].includes(session.status)) redirect("/");
  if (!session.ok) return <main><h1>Sesión no disponible</h1><p>No se pudo comprobar tu sesión. Intenta nuevamente en unos minutos.</p><Link href="/">Volver al acceso</Link></main>;
  return <AppShell>{children}</AppShell>;
}
