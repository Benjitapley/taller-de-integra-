import MyRental from "@/features/arriendos/MyRental";
import { reportsEnabled } from "@/lib/reportes";

export default function RentalPage() {
  return <MyRental canReport={reportsEnabled()} />;
}
