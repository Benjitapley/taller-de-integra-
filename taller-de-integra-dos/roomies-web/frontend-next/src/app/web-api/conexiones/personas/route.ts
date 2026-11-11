import { handlePeopleSearch } from "@/lib/conexiones/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handlePeopleSearch(request);
}
