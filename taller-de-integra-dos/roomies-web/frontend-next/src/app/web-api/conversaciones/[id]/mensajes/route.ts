import { handleMessages } from "@/lib/recorrido/chat";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return handleMessages(request,(await params).id)}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return handleMessages(request,(await params).id)}
