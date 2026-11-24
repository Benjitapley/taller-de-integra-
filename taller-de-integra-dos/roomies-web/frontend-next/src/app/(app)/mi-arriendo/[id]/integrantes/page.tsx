import MemberDirectory from "@/features/recorrido/MemberDirectory";

export default async function RentalMembersPage({ params }: { params: Promise<{ id: string }> }) {
  return <MemberDirectory rentalId={(await params).id} />;
}
