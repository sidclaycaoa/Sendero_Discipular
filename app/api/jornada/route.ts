import { respond } from "@/lib/respond";
import { closeCycle, saveCycleText } from "@/lib/db/jornada";

/** PATCH: one of the month's texts (monster, master, abyss, elixir). POST: close the labor. */
export const PATCH = (request: Request) => respond(request, (userId, body) => saveCycleText(userId, body));
export const POST = (request: Request) => respond(request, (userId, body) => closeCycle(userId, body));
