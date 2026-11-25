import { handleTasks } from "@/lib/recorrido/tasks";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { return handleTasks(request, (await params).id, "rental"); }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { return handleTasks(request, (await params).id, "rental"); }
