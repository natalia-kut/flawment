import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";
import type { AbsenceType } from "@/src/generated/prisma/enums";
import { daySpan, isValidDay, addDays } from "./dates";

export class TimeOffError extends Error {}

const absenceTypes: AbsenceType[] = ["VACATION", "SICK_LEAVE", "BUSINESS_TRIP", "OTHER"];
const MAX_DAYS = 366;
const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

/** Add or remove the actor's own time off. Nobody edits someone else's calendar. */
export async function mutateTimeOff(actor: Actor, data: FormData, today: string) {
  const operation = field(data, "operation");
  if (operation === "delete") {
    const id = Number(field(data, "absence_id"));
    if (!Number.isSafeInteger(id) || id <= 0) throw new TimeOffError("Invalid time off entry.");
    const { count } = await prisma.absence.deleteMany({ where: { id, user_id: actor.id } });
    if (!count) throw new TimeOffError("This time off no longer exists.");
    return;
  }
  if (operation !== "create") throw new TimeOffError("Unknown time off operation.");

  const type = field(data, "type") as AbsenceType;
  const start = field(data, "start_date"), end = field(data, "end_date") || start;
  const note = field(data, "note");
  if (!absenceTypes.includes(type)) throw new TimeOffError("Choose a type of time off.");
  if (!isValidDay(start) || !isValidDay(end)) throw new TimeOffError("Enter valid dates.");
  if (end < start) throw new TimeOffError("The last day cannot be before the first day.");
  if (daySpan(start, end) > MAX_DAYS) throw new TimeOffError("Time off can last up to a year at a time.");
  // Fixing the recent past (a forgotten sick day) is fine; rewriting old history is not.
  if (end < addDays(today, -30)) throw new TimeOffError("Time off can be added up to 30 days back.");
  if (note.length > 200) throw new TimeOffError("Keep the note under 200 characters.");

  return prisma.$transaction(async (tx) => {
    const overlap = await tx.absence.findFirst({
      where: { user_id: actor.id, start_date: { lte: new Date(end) }, end_date: { gte: new Date(start) } },
      select: { id: true },
    });
    if (overlap) throw new TimeOffError("You already have time off on some of these days.");
    return tx.absence.create({
      data: { user_id: actor.id, type, start_date: new Date(start), end_date: new Date(end), note: note || null },
      select: { id: true },
    });
  }, { isolationLevel: "Serializable" });
}
