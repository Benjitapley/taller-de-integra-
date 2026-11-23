import MyRental from "@/features/arriendos/MyRental";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyRental publicationId={id} />;
}
