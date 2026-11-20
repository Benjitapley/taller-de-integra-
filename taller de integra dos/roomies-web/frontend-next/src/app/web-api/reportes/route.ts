import { handleReports } from "@/lib/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleReports(request);
}

export function POST(request: Request) {
  return handleReports(request);
}
