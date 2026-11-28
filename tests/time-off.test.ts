import test from "node:test";
import assert from "node:assert/strict";
import { availability, mergeRanges, upcomingRanges } from "../lib/time-off/availability";
import { daySpan, daysUntilBirthday, formatBirthday, formatMonthTick, formatRange, formatShortDay, nextAnniversary, todaysCelebrations, workspaceToday } from "../lib/time-off/dates";
import { activeStatus, statusExpiry, workspaceMidnight } from "../lib/status/status";

test("day helpers count both ends and format without the year", () => {
  assert.equal(daySpan("2026-11-12", "2026-11-12"), 1);
  assert.equal(daySpan("2026-12-30", "2027-01-02"), 4);
  assert.equal(formatRange("2026-11-12", "2026-11-12"), "12 Nov");
  assert.equal(formatRange("2026-11-12", "2026-11-20"), "12 Nov – 20 Nov");
  assert.equal(formatBirthday("1995-03-14"), "14 March");
  // 23:30 UTC is already the next day in Warsaw.
  assert.equal(workspaceToday(new Date("2026-11-12T23:30:00Z")), "2026-11-13");
});

test("birthdays count down to the next one, with 29 February on the 28th in other years", () => {
  assert.equal(daysUntilBirthday("1990-11-12", "2026-11-12"), 0);
  assert.equal(daysUntilBirthday("1990-11-13", "2026-11-12"), 1);
  assert.equal(daysUntilBirthday("1990-11-11", "2026-11-12"), 364);
  assert.equal(daysUntilBirthday("2000-02-29", "2027-02-27"), 1);
  assert.equal(daysUntilBirthday("2000-02-29", "2028-02-28"), 1);
});

test("availability says who is away now or soon, merging back-to-back absences", () => {
  const today = "2026-11-12";
  assert.equal(availability([], today), null);
  assert.equal(availability([{ start: "2026-11-01", end: "2026-11-11" }], today), null, "past time off is ignored");
  assert.equal(availability([{ start: "2026-12-20", end: "2026-12-24" }], today), null, "beyond the lookahead");
  assert.deepEqual(availability([{ start: "2026-11-10", end: "2026-11-14" }, { start: "2026-11-15", end: "2026-11-18" }], today),
    { state: "away", until: "2026-11-18", label: "Out of office until 18 Nov" });
  assert.deepEqual(availability([{ start: "2026-11-20", end: "2026-11-21" }], today),
    { state: "soon", from: "2026-11-20", to: "2026-11-21", label: "Away 20 Nov – 21 Nov" });
  assert.deepEqual(availability([{ start: "2026-11-10", end: "2026-11-14", type: "SICK_LEAVE" }, { start: "2026-11-15", end: "2026-11-18", type: "BUSINESS_TRIP" }], today)?.reasons,
    ["SICK_LEAVE", "BUSINESS_TRIP"], "reasons appear only when the ranges carry them");
  assert.deepEqual(mergeRanges([{ start: "2026-11-05", end: "2026-11-06" }, { start: "2026-11-01", end: "2026-11-03" }]),
    [{ start: "2026-11-01", end: "2026-11-03", types: [] }, { start: "2026-11-05", end: "2026-11-06", types: [] }], "a one-day gap keeps ranges apart");
});

test("work anniversaries count whole years from the day the account was created", () => {
  assert.deepEqual(nextAnniversary("2022-11-12", "2026-11-12"), { years: 4, inDays: 0 });
  assert.deepEqual(nextAnniversary("2025-11-14", "2026-11-12"), { years: 1, inDays: 2 });
  assert.deepEqual(nextAnniversary("2026-03-01", "2026-11-12"), { years: 1, inDays: 109 }, "the first one is still ahead");
  assert.equal(nextAnniversary("2026-11-12", "2026-11-12"), null, "an account made today has none yet");
  assert.deepEqual(todaysCelebrations("Ann", "1990-11-12", "2023-11-12", "2026-11-12").map((c) => c.kind), ["birthday", "anniversary"]);
  assert.equal(todaysCelebrations("Ann", null, "2023-11-13", "2026-11-12").length, 0);
});

test("statuses expire on time in the workspace time zone and hide once expired", () => {
  // 12:00 in Warsaw (UTC+1 in November).
  const now = new Date("2026-11-12T11:00:00Z");
  assert.equal(statusExpiry("never", now), null);
  assert.equal(statusExpiry("30m", now)?.toISOString(), "2026-11-12T11:30:00.000Z");
  assert.equal(statusExpiry("today", now)?.toISOString(), "2026-11-12T23:00:00.000Z", "Warsaw midnight");
  assert.equal(statusExpiry("week", now)?.toISOString(), "2026-11-15T23:00:00.000Z", "end of Sunday");
  assert.equal(workspaceMidnight("2026-07-01").toISOString(), "2026-06-30T22:00:00.000Z", "summer time is UTC+2");
  const lunch = { status_emoji: "🍽️", status_text: "Lunch", status_expires_at: statusExpiry("1h", now) };
  assert.deepEqual(activeStatus(lunch, now), { emoji: "🍽️", text: "Lunch", until: "2026-11-12T12:00:00.000Z", untilLabel: "Until 13:00" });
  assert.equal(activeStatus({ ...lunch, status_expires_at: statusExpiry("today", now) }, now)?.untilLabel, "Until end of today");
  // "This week" ends at Monday 00:00: it lasts through Sunday, and says so.
  assert.equal(activeStatus({ ...lunch, status_expires_at: statusExpiry("week", now) }, now)?.untilLabel, "Until end of Sunday");
  assert.equal(activeStatus(lunch, new Date("2026-11-12T12:00:00Z")), null, "expired at its end time");
  assert.equal(activeStatus({ status_emoji: null, status_text: null, status_expires_at: null }, now), null);
});

test("dates show the year when it is not the current one", () => {
  const today = "2026-11-25";
  assert.equal(formatShortDay("2026-12-02", today), "2 Dec");
  assert.equal(formatShortDay("2027-11-19", today), "19 Nov 2027");
  assert.equal(formatShortDay("2025-11-30", today), "30 Nov 2025");
  assert.equal(formatRange("2026-12-02", "2026-12-05", today), "2 Dec – 5 Dec");
  assert.equal(formatRange("2027-01-01", "2028-01-01", today), "1 Jan 2027 – 1 Jan 2028");
  assert.equal(formatRange("2026-12-20", "2027-01-03", today), "20 Dec – 3 Jan 2027");
  assert.equal(formatRange("2027-02-01", "2027-02-05", today), "1 Feb – 5 Feb 2027");
  assert.equal(formatRange("2027-03-04", "2027-03-04", today), "4 Mar 2027");
  assert.equal(formatMonthTick("2026-02-01", true), "Feb 2026");
  assert.equal(formatMonthTick("2026-05-01", false), "May");
  assert.equal(formatMonthTick("2027-01-01", false), "Jan 2027");
});

test("back-to-back time off reads as one absence even past the lookahead", () => {
  const today = "2026-11-25";
  const chain = [{ start: "2026-11-24", end: "2026-12-10" }, { start: "2026-12-11", end: "2026-12-20" }];
  const away = availability(chain, today);
  assert.equal(away?.state === "away" ? away.until : null, "2026-12-20");
  // Later, separate time off is not shared: only what starts within the lookahead.
  assert.deepEqual(upcomingRanges([...chain, { start: "2027-03-01", end: "2027-03-05" }], today).map((r) => [r.start, r.end]), [["2026-11-24", "2026-12-20"]]);
});
