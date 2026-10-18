import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/db/sendero";
import { getVapidKeys, removeSubscription, saveSubscription } from "@/lib/db/lembretes";

/** The public key the phone needs to sign up for notifications. */
export async function GET() {
  const keys = await getVapidKeys();
  return NextResponse.json({ publicKey: keys.publicKey });
}

export async function POST(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    await saveSubscription(user.id, body, new URL(request.url).origin);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível ativar." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { endpoint?: unknown };
  await removeSubscription(user.id, body.endpoint);
  return NextResponse.json({ saved: true });
}
