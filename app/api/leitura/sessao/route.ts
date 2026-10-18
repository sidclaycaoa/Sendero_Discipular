import { addReadingSession } from "@/lib/db/leitura";
import { requireId, respond } from "@/lib/respond";

export const POST = (request: Request) => respond(request, (userId, body) => addReadingSession(userId, requireId(body), body));
