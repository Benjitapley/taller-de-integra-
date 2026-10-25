import PageHeader from "@/components/layout/PageHeader";
import ProfileView from "@/features/perfil/ProfileView";

export default function ProfilePage() {
  return <main><PageHeader title="Mi perfil" description="Consulta la información de tu cuenta en ¿Hay cupo?." /><ProfileView /></main>;
}
