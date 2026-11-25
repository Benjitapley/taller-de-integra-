import OwnerRentalView from "@/features/recorrido/OwnerRentalView";

export default async function OwnerRentalPage({ params }: { params: Promise<{ id: string }> }) {
  return <OwnerRentalView rentalId={(await params).id} />;
}
