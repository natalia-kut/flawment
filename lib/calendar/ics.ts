import { addDays } from "@/lib/time-off/dates";

/**
 * A minimal iCalendar (RFC 5545) writer for all-day events: enough for Google,
 * Outlook and Apple Calendar to subscribe to. All-day dates carry no time zone,
 * so a deadline stays on its Warsaw day wherever the calendar is opened.
 */

export type CalendarEvent = {
  /** Stable across refreshes, so a calendar updates an event instead of adding it again. */
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  /** Warsaw days, both inclusive. */
  start: string;
  end: string;
  /** Busy (time off) or free (a deadline does not block the day). */
  busy?: boolean;
  categories?: string[];
};

/** Text values escape backslashes, semicolons, commas and line breaks. */
export function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Lines longer than 75 bytes continue on the next line after a space, never inside a character. */
export function foldLine(line: string) {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "", size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // The first line may hold 75 bytes; the others 74, after their leading space.
    if (size + bytes > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const day = (value: string) => value.replaceAll("-", "");
const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildCalendar(name: string, events: CalendarEvent[], now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flawment//Calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    // How often to check for changes; calendars treat it as a hint.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${day(event.start)}`,
      // The end of an all-day event is the day after it, exclusive.
      `DTEND;VALUE=DATE:${day(addDays(event.end, 1))}`,
      `SUMMARY:${escapeText(event.summary)}`,
      ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
      ...(event.url ? [`URL:${event.url}`] : []),
      ...(event.categories?.length ? [`CATEGORIES:${event.categories.map(escapeText).join(",")}`] : []),
      `TRANSP:${event.busy ? "OPAQUE" : "TRANSPARENT"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
