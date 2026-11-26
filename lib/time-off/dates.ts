/**
 * Calendar-day helpers. Absences, birthdays and deadlines are plain dates
 * (`@db.Date`), so everything here works on "YYYY-MM-DD" strings in UTC and
 * never on local times, which would shift a day across time zones.
 */

/** Today in the workspace's time zone, as "YYYY-MM-DD". */
export function workspaceToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isValidDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function addDays(day: string, days: number) {
  const date = new Date(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Days from `from` to `to`; both ends count, so a one-day absence is 1. */
export function daySpan(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const shortWithYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * "14 Nov" this year, "14 Nov 2027" in any other: without the year, "until
 * 19 Nov" a year ahead reads as already over. `today` is the workspace day.
 */
export const formatShortDay = (day: string, today = workspaceToday()) =>
  (day.slice(0, 4) === today.slice(0, 4) ? short : shortWithYear).format(new Date(day));
/** "14 November": how a birthday is shown, without the year. */
export const formatBirthday = (day: string) => long.format(new Date(day));

/** "14 Nov" for one day, otherwise "14 – 20 Nov"; the year shows as for formatShortDay ("20 Dec 2026 – 3 Jan 2027"). */
export function formatRange(from: string, to: string, today = workspaceToday()) {
  if (from === to) return formatShortDay(from, today);
  // Both in the same other year: the year once, at the end ("1 – 5 Jan 2027").
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? short.format(new Date(from)) : formatShortDay(from, today)} – ${formatShortDay(to, today)}`;
}

/** A month label for a chart axis: "Mar", or "Jan 2027" on the first tick and on each January. */
export function formatMonthTick(month: string, first: boolean) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", ...(first || month.slice(5, 7) === "01" ? { year: "numeric" } : {}), timeZone: "UTC" })
    .format(new Date(month.slice(0, 7) + "-01"));
}

/**
 * Days until the next birthday (0 = today). A 29 February birthday is
 * celebrated on 28 February in other years.
 */
export function daysUntilBirthday(birthDate: string, today: string) {
  const [, month, day] = birthDate.split("-").map(Number);
  const year = Number(today.slice(0, 4));
  const next = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const d = month === 2 && day === 29 && !leap ? 28 : day;
    return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const thisYear = next(year);
  return daySpan(today, thisYear >= today ? thisYear : next(year + 1)) - 1;
}

/** The calendar day of a moment in the workspace time zone, as "YYYY-MM-DD". */
export const workspaceDay = (date: Date) => workspaceToday(date);

/**
 * The next work anniversary, counting from the day the account was created.
 * Null only for an account created today, whose "next" date is not a full year yet.
 */
export function nextAnniversary(startDay: string, today: string) {
  const inDays = daysUntilBirthday(startDay, today);
  const year = Number(addDays(today, inDays).slice(0, 4));
  const years = year - Number(startDay.slice(0, 4));
  return years >= 1 ? { years, inDays } : null;
}

export const yearsLabel = (years: number) => `${years} ${years === 1 ? "year" : "years"}`;

export type Celebration = { kind: "birthday" | "anniversary"; emoji: string; title: string; text: string };

/** What to celebrate with someone today: their birthday and/or work anniversary. */
export function todaysCelebrations(firstName: string, birthDay: string | null, startDay: string, today: string): Celebration[] {
  const result: Celebration[] = [];
  if (birthDay && daysUntilBirthday(birthDay, today) === 0) {
    result.push({ kind: "birthday", emoji: "🎂", title: `Happy birthday, ${firstName}!`, text: "Wishing you a great day from everyone at Flawment." });
  }
  const anniversary = nextAnniversary(startDay, today);
  if (anniversary?.inDays === 0) {
    result.push({ kind: "anniversary", emoji: "🎉", title: `${yearsLabel(anniversary.years)} with us today!`, text: "Happy work anniversary, and thank you for everything you bring to the team." });
  }
  return result;
}
