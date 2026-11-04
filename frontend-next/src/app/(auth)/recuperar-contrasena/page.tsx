import PasswordRecovery from "@/features/auth/PasswordRecovery";
export const dynamic = "force-dynamic";
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const message = query.estado === "enlace-invalido" ? "El enlace no es válido o ha expirado. Solicita uno nuevo." : query.estado === "servicio-no-disponible" ? "No se pudo comprobar el enlace. Intenta nuevamente más tarde." : "";
  return <PasswordRecovery initialError={message} />;
}
