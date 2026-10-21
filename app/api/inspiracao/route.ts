import { respond } from "@/lib/respond";
import { drawInspiration } from "@/lib/db/inspiracao";

/** Draws a passage to reflect on; the body may carry a source, a theme and the keys already shown. */
export const POST = (request: Request) => respond(request, (userId, body) => drawInspiration(userId, body));
