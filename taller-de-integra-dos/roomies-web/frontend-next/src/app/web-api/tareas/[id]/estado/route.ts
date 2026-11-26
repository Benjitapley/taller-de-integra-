import { handleTasks } from "@/lib/recorrido/tasks";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { return handleTasks(request, (await params).id, "complete"); }
