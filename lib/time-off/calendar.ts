import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";
import type { AbsenceType } from "@/src/generated/prisma/enums";
import { getViewer } from "@/lib/teams/data";
import { addDays } from "./dates";

export type CalendarTimeOff = { id: number; mine: boolean; name: string; type: AbsenceType; start: string; end: string };

/** The calendar can page back a couple of months and ahead about a year. */
const BACK_DAYS = 62, AHEAD_DAYS = 400;

/**
 * Time off for the dashboard calendar: your own, plus your team's when you
 * lead it. Leads already know the reason (see canSeeAbsenceReason), so the
 * type comes along; the note never does.
 */
export async function getCalendarTimeOff(actor: Actor, today: string): Promise<CalendarTimeOff[]> {
  const viewer = await getViewer(actor);
  const whose = [
    { user_id: actor.id },
    ...(viewer.team_lead && viewer.team_id !== null ? [{ user: { team_id: viewer.team_id, is_active: true } }] : []),
  ];
  const rows = await prisma.absence.findMany({
    where: { OR: whose, end_date: { gte: new Date(addDays(today, -BACK_DAYS)) }, start_date: { lte: new Date(addDays(today, AHEAD_DAYS)) } },
    orderBy: { start_date: "asc" },
    select: { id: true, user_id: true, type: true, start_date: true, end_date: true, user: { select: { first_name: true, last_name: true } } },
  });
  return rows.map((row) => ({
    id: row.id, mine: row.user_id === actor.id, name: `${row.user.first_name} ${row.user.last_name}`, type: row.type,
    start: row.start_date.toISOString().slice(0, 10), end: row.end_date.toISOString().slice(0, 10),
  }));
}
