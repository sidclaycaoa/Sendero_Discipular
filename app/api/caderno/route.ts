import { respond } from "@/lib/respond";
import { runCadernoAction } from "@/lib/db/caderno";

/** Every change in the Caderno; the body's "action" says which (see runCadernoAction). */
export const POST = (request: Request) => respond(request, (userId, body) => runCadernoAction(userId, body));
