import type { ReactNode } from "react";
import { cookies } from "next/headers";
import MemberAccessGate from "./MemberAccessGate";
import Card from "@/components/ui/Card";
import { handleMyArriendo } from "@/lib/recorrido/server";

export default async function MemberPageGate({ children }: { children: ReactNode }) {
  const cookieHeader = (await cookies()).toString();
  const response = await handleMyArriendo(new Request("http://roomies.local/web-api/arriendos/mio", { headers: { cookie: cookieHeader } }));
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return <main><Card><h1>Acceso no disponible</h1><p>El chat y las tareas son privados para integrantes activos del arriendo.</p></Card></main>;
  }
  if (!response.ok) return <main><Card><p role="alert">No pudimos verificar tu acceso al arriendo. Intenta nuevamente.</p></Card></main>;
  const rental = await response.json();
  if (rental.estado !== "Activo") return <main><Card><h1>Acceso no disponible</h1><p>El chat y las tareas son privados para integrantes activos del arriendo.</p></Card></main>;
  return <MemberAccessGate>{children}</MemberAccessGate>;
}
