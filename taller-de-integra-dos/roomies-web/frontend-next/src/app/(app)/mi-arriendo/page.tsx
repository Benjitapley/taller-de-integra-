import RentalWithReports from "@/features/reportes/RentalWithReports";
import { reportsEnabled } from "@/lib/reportes";

export default function RentalPage() {
  return <RentalWithReports canReport={reportsEnabled()} />;
}
