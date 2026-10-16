import { handleMcpRequest } from "@/worker/mcp";
import { getSenderoDb } from "@/lib/db/bindings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) { return handleMcpRequest(request, getSenderoDb()); }
export async function POST(request: Request) { return handleMcpRequest(request, getSenderoDb()); }
export async function DELETE(request: Request) { return handleMcpRequest(request, getSenderoDb()); }
