import { clearCheckedShopping, rescheduleLate } from "@/lib/db/agenda";
import { getSaoPauloDateKey } from "@/lib/date";
import { respond } from "@/lib/respond";

/** Agenda bulk actions: move late tasks to today, clear bought items. */
export const POST = (request: Request) => respond(request, (userId, body) => {
  if (body.action === "remarcarAtrasadas") return rescheduleLate(userId, getSaoPauloDateKey());
  if (body.action === "limparComprados") return clearCheckedShopping(userId);
  throw new Error("Ação desconhecida.");
});
