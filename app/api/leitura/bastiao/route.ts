import { saveBastiaoUrl, saveBastiaoWeek } from "@/lib/db/leitura";
import { respond } from "@/lib/respond";

/** The week's title, read mark and notes; or, with `url`, the address of the Bastião site. */
export const PATCH = (request: Request) => respond(request, (userId, body) =>
  "url" in body ? saveBastiaoUrl(userId, body.url) : saveBastiaoWeek(userId, body));
