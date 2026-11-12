import { addDays, workspaceToday } from "@/lib/time-off/dates";

/** How long a status lasts. The server turns this into a time, so a wrong client clock cannot. */
export const clearAfterOptions = {
  never: "Don't clear",
  "30m": "30 minutes",
  "1h": "1 hour",
  "4h": "4 hours",
  today: "Today",
  week: "This week",
} as const;
export type ClearAfter = keyof typeof clearAfterOptions;

/** Quick picks for the statuses people set most often. */
export const statusPresets: { emoji: string; text: string; clearAfter: ClearAfter }[] = [
  { emoji: "🍽️", text: "Lunch", clearAfter: "1h" },
  { emoji: "🚗", text: "Commuting", clearAfter: "30m" },
  { emoji: "📅", text: "In a meeting", clearAfter: "1h" },
  { emoji: "🎯", text: "Focusing", clearAfter: "4h" },
  { emoji: "🏠", text: "Working remotely", clearAfter: "today" },
  { emoji: "🤒", text: "Out sick", clearAfter: "today" },
];

const ZONE = "Europe/Warsaw";

/** The UTC instant of midnight starting `day` in the workspace time zone (DST-safe). */
export function workspaceMidnight(day: string) {
  const guess = Date.parse(day + "T00:00:00Z");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (local - guess));
}

export function statusExpiry(clearAfter: ClearAfter, now = new Date()): Date | null {
  const today = workspaceToday(now);
  switch (clearAfter) {
    case "never": return null;
    case "30m": return new Date(now.getTime() + 30 * 60_000);
    case "1h": return new Date(now.getTime() + 60 * 60_000);
    case "4h": return new Date(now.getTime() + 4 * 60 * 60_000);
    case "today": return workspaceMidnight(addDays(today, 1));
    case "week": { // Until the end of Sunday.
      const weekday = new Date(today).getUTCDay(); // 0 = Sunday
      return workspaceMidnight(addDays(today, ((7 - weekday) % 7) + 1));
    }
  }
}

export type Status = { emoji: string | null; text: string; until: string | null; untilLabel: string | null };

const time = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "long" });

/** The status to show, or null once it has expired (expired rows are simply ignored, never cleaned up eagerly). */
export function activeStatus(row: { status_emoji: string | null; status_text: string | null; status_expires_at: Date | null }, now = new Date()): Status | null {
  if (!row.status_text && !row.status_emoji) return null;
  if (row.status_expires_at && row.status_expires_at <= now) return null;
  const until = row.status_expires_at;
  let untilLabel: string | null = null;
  if (until) {
    const sameDay = workspaceToday(until) === workspaceToday(now);
    // Midnight reads better as "until tomorrow" / "until Monday" than "until 00:00".
    const atMidnight = time.format(until) === "00:00";
    if (atMidnight) untilLabel = workspaceToday(until) === addDays(workspaceToday(now), 1) ? "Until tomorrow" : `Until ${weekday.format(until)}`;
    else untilLabel = sameDay ? `Until ${time.format(until)}` : `Until ${weekday.format(until)} ${time.format(until)}`;
  }
  return { emoji: row.status_emoji, text: row.status_text ?? "", until: until?.toISOString() ?? null, untilLabel };
}

export const statusSelect = { status_emoji: true, status_text: true, status_expires_at: true } as const;
