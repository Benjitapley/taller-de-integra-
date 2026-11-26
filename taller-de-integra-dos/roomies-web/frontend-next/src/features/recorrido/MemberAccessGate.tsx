"use client";

import { Fragment, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useActiveRental } from "@/features/convivencia/useActiveRental";

export default function MemberAccessGate({ children }: { children: ReactNode }) {
  const { rental, status: state, retry } = useActiveRental();
  if (state === "loading") return <main><Card><p role="status">Verificando acceso al arriendo…</p></Card></main>;
  if (state === "denied" || state === "empty") return <main><Card><h1>Acceso no disponible</h1><p>Sin arriendo activo. El chat y las tareas son privados para integrantes activos del arriendo.</p></Card></main>;
  if (state === "error") return <main><Card><p role="alert">No pudimos verificar tu acceso al arriendo. Intenta nuevamente.</p><Button onClick={retry}>Reintentar</Button></Card></main>;
  return <Fragment key={rental?.id_arriendo}>{children}</Fragment>;
}
