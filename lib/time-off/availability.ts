import type { AbsenceType } from "@/src/generated/prisma/enums";
import { addDays, formatShortDay, formatRange } from "./dates";

/** How far ahead an upcoming absence is worth a warning (e.g. when adding someone to a project). */
const LOOKAHEAD_DAYS = 14;

/** `type` is filled in only when the viewer may know why someone is away. */
type DayRange = { start: string; end: string; type?: AbsenceType };

/**
 * What a viewer may know about someone's time off. Everyone learns that they
 * are away and when; `reasons` (sick leave is health data) only reaches their
 * team lead and super admins. The note never leaves its author.
 */
export type Availability =
  | { state: "away"; until: string; label: string; reasons?: AbsenceType[] }
  | { state: "soon"; from: string; to: string; label: string; reasons?: AbsenceType[] }
  | null;

type Merged = { start: string; end: string; types: AbsenceType[] };

/** Joins ranges that overlap or touch (holiday straight into a business trip reads as one absence). */
export function mergeRanges(ranges: DayRange[]): Merged[] {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  const merged: Merged[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= addDays(last.end, 1)) {
      if (range.end > last.end) last.end = range.end;
      if (range.type && !last.types.includes(range.type)) last.types.push(range.type);
    } else merged.push({ start: range.start, end: range.end, types: range.type ? [range.type] : [] });
  }
  return merged;
}

export function availability(ranges: DayRange[], today: string): Availability {
  const horizon = addDays(today, LOOKAHEAD_DAYS);
  const next = mergeRanges(ranges).find((range) => range.end >= today && range.start <= horizon);
  if (!next) return null;
  const reasons = next.types.length ? { reasons: next.types } : {};
  if (next.start <= today) return { state: "away", until: next.end, label: `Out of office until ${formatShortDay(next.end)}`, ...reasons };
  return { state: "soon", from: next.start, to: next.end, label: `Away ${formatRange(next.start, next.end)}`, ...reasons };
}

/** Prisma filter for the absences that can affect `availability` on `today`. */
export function relevantAbsences(today: string) {
  return { end_date: { gte: new Date(today) }, start_date: { lte: new Date(addDays(today, LOOKAHEAD_DAYS)) } };
}

export const absenceSelect = (today: string) => ({ where: relevantAbsences(today), select: { start_date: true, end_date: true, type: true } }) as const;

/**
 * Absences as plain day ranges (Prisma returns `@db.Date` columns as midnight
 * UTC). Pass `withType` only for a viewer allowed to see the reason.
 */
export function toRanges(absences: { start_date: Date; end_date: Date; type?: AbsenceType }[], withType = false): DayRange[] {
  return absences.map((a) => ({
    start: a.start_date.toISOString().slice(0, 10), end: a.end_date.toISOString().slice(0, 10),
    ...(withType && a.type ? { type: a.type } : {}),
  }));
}

/** May `viewer` know why `person` is away? Themselves, their team lead, or a super admin. */
export function canSeeAbsenceReason(
  viewer: { id: number; role: string; team_id: number | null; team_lead: boolean },
  person: { id: number; team_id: number | null },
) {
  return viewer.role === "SUPER_ADMIN" || viewer.id === person.id
    || (viewer.team_lead && viewer.team_id !== null && viewer.team_id === person.team_id);
}
