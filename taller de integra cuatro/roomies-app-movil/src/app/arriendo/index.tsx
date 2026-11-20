import DashboardArriendoDemo from "@/components/convivencia/DashboardArriendoDemo";
import MiArriendo from "@/components/convivencia/MiArriendo";
import { CONVIVENCIA_DEMO_ACTIVA } from "@/config/modoDemo";

export default function RutaArriendo() {
  return CONVIVENCIA_DEMO_ACTIVA ? <DashboardArriendoDemo /> : <MiArriendo />;
}
