import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import ProfileView from "@/features/perfil/ProfileView";
import { reportsEnabled } from "@/lib/reportes";

export default function ProfilePage() {
  return <main>
    <PageHeader title="Mi perfil" description="Consulta la información de tu cuenta en ¿Hay cupo?." />
    {reportsEnabled() && <p><Link href="/mis-reportes">Mis reportes</Link></p>}
    <ProfileView />
  </main>;
}
