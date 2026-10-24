import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";

// Organización visual: este layout no autentica ni autoriza peticiones.
export default function ApplicationLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
