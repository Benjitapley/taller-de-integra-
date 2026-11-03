import { handleAdmin } from "@/lib/admin/server";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleAdmin(request);
