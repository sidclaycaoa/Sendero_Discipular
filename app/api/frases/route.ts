import { respond } from "@/lib/respond";
import { runPassageAction } from "@/lib/db/frases";

/** Frases e passagens; the body's "action" says which (see runPassageAction). */
export const POST = (request: Request) => respond(request, (userId, body) => runPassageAction(userId, body));
