"use client";

import { type ReactNode } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useActiveRental } from "@/features/convivencia/useActiveRental";

export default function MemberAccessGate({ children }: { children: ReactNode }) {
  const { status: state, retry } = useActiveRental();
  if (state === "loading") return <main><Card><p role="status">Verificando acceso al arriendo…</p></Card></main>;
  if (state === "denied" || state === "empty") return <main><Card><h1>Sin arriendo activo</h1><p>El chat y las tareas son privados para integrantes activos del arriendo.</p></Card></main>;
  if (state === "error") return <main><Card><p role="alert">No pudimos verificar tu acceso al arriendo. Intenta nuevamente.</p><Button onClick={retry}>Reintentar</Button></Card></main>;
  return children;
}
