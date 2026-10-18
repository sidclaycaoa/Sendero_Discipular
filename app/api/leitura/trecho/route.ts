import { addReadingQuote, deleteReadingQuote, quoteToMemorization } from "@/lib/db/leitura";
import { requireId, respond } from "@/lib/respond";

/** New passage on an item (`id` is the item); `memorizar: true` turns passage `id` into a Memorização text. */
export const POST = (request: Request) => respond(request, (userId, body) =>
  body.memorizar ? quoteToMemorization(userId, requireId(body)) : addReadingQuote(userId, requireId(body), body));
export const DELETE = (request: Request) => respond(request, (userId, body) => deleteReadingQuote(userId, requireId(body)));
