import { AgendaScreen, type AgendaView } from "@/components/agenda/AgendaScreen";
import { getActiveUser } from "@/lib/db/sendero";
import { getAgendaDay, getAgendaWeek, getShopping } from "@/lib/db/agenda";
import { getSaoPauloDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function AgendaPage({ searchParams }: { searchParams?: Promise<{ data?: string; ver?: string }> }) {
  const params = await searchParams;
  const today = getSaoPauloDateKey();
  const date = isDateKey(params?.data) ? params.data : today;
  const view: AgendaView = params?.ver === "semana" || params?.ver === "compras" ? params.ver : "dia";
  const user = await getActiveUser();
  const [day, week, shopping] = user ? await Promise.all([
    view === "dia" ? getAgendaDay(user.id, date, today) : null,
    view === "semana" ? getAgendaWeek(user.id, date) : null,
    view === "compras" ? getShopping(user.id) : null,
  ]) : [null, null, null];
  return <AgendaScreen view={view} date={date} today={today} day={day} week={week} shopping={shopping} />;
}

function isDateKey(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
