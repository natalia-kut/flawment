import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendar, escapeText, foldLine } from "../lib/calendar/ics";

test("text values escape what iCalendar treats as syntax", () => {
  assert.equal(escapeText("a, b; c\\d\ne"), "a\\, b\\; c\\\\d\\ne");
});

test("long lines fold at 75 bytes without splitting a character", () => {
  const line = "SUMMARY:" + "żółć ".repeat(30);
  const folded = foldLine(line);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1);
  for (const [index, part] of parts.entries()) {
    assert.ok(new TextEncoder().encode(part).length <= 75, `line ${index} is too long`);
    if (index > 0) assert.equal(part[0], " ");
  }
  // Unfolding gives the original back, so no byte of a Polish letter was lost.
  assert.equal(folded.replace(/\r\n /g, ""), line);
  assert.equal(foldLine("SUMMARY:short"), "SUMMARY:short");
});

test("an all-day event ends on the day after it, and the file uses CRLF", () => {
  const ics = buildCalendar("Flawment", [
    { uid: "time-off-1@example.test", summary: "Vacation", start: "2026-12-22", end: "2026-12-29", busy: true },
    { uid: "task-2@example.test", summary: "Due: Ship, then rest", start: "2026-12-31", end: "2026-12-31", url: "https://example.test/?task=2" },
  ], new Date("2026-11-28T12:00:00.000Z"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false);
  const lines = ics.split("\r\n");
  assert.ok(lines.includes("DTSTAMP:20261128T120000Z"));
  assert.ok(lines.includes("DTSTART;VALUE=DATE:20261222"));
  assert.ok(lines.includes("DTEND;VALUE=DATE:20261230"));
  // Across the new year too.
  assert.ok(lines.includes("DTEND;VALUE=DATE:20270101"));
  assert.ok(lines.includes("SUMMARY:Due: Ship\\, then rest"));
  assert.deepEqual(lines.filter((line) => line.startsWith("TRANSP:")), ["TRANSP:OPAQUE", "TRANSP:TRANSPARENT"]);
});
