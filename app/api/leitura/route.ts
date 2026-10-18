import { archiveReadingItem, createReadingItem, updateReadingItem } from "@/lib/db/leitura";
import { requireId, respond } from "@/lib/respond";

export const POST = (request: Request) => respond(request, (userId, body) => createReadingItem(userId, body));
export const PATCH = (request: Request) => respond(request, (userId, body) => updateReadingItem(userId, requireId(body), body));
export const DELETE = (request: Request) => respond(request, (userId, body) => archiveReadingItem(userId, requireId(body)));
