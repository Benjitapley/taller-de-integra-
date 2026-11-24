import Link from "next/link";
import Card from "@/components/ui/Card";

export default function ReportAccessState({ status }: { status: number }) {
  return <Card><h1>{status === 401 ? "Sesión expirada" : "Acceso administrativo requerido"}</h1>
    <p role="alert">{status === 401 ? "Vuelve a iniciar sesión para consultar los reportes." : "Tu cuenta no tiene permiso para revisar reportes."}</p>
    <Link href={status === 401 ? "/" : "/inicio"}>{status === 401 ? "Iniciar sesión" : "Volver al inicio"}</Link>
  </Card>;
}
