import RentalWithReports from "@/features/reportes/RentalWithReports";
export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <RentalWithReports rentalId={(await params).id} />;
}
