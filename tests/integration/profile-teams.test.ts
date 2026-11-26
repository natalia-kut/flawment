import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { mutateTimeOff } from "../../lib/time-off/service";
import { setStatus } from "../../lib/status/service";
import { updatePerson } from "../../lib/people/service";
import { mutateTitleRequest } from "../../lib/job-title-requests/service";
import { getPromotions } from "../../lib/job-title-requests/data";
import { mutateTeam } from "../../lib/teams/service";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("profile, time off and team rules", async () => {
  const prefix = "pt-test-" + randomUUID().slice(0, 8);
  const users: number[] = [];
  const teams: number[] = [];
  try {
    for (const suffix of ["admin", "lead1", "lead2", "person"]) {
      users.push((await prisma.user.create({ data: {
        username: prefix + suffix, email: prefix + suffix + "@example.test", password: "unused-test-hash",
        first_name: "Test", last_name: suffix, role: suffix === "admin" ? "SUPER_ADMIN" : "USER",
      } })).id);
    }
    const [admin, lead1, lead2, person] = users.map((id, index) => ({ id, role: index === 0 ? "SUPER_ADMIN" as const : "USER" as const }));

    // Time off may start at most 30 days back: the first day counts, not only the last.
    const today = "2026-11-25";
    await assert.rejects(mutateTimeOff(person, form({ operation: "create", type: "VACATION", start_date: "2025-12-01", end_date: "2026-11-01" }), today), /30 days back/);
    await mutateTimeOff(person, form({ operation: "create", type: "VACATION", start_date: "2026-11-01", end_date: "2026-11-02" }), today);

    // Editing a status with "keep" leaves its end time as it was.
    const now = new Date("2026-11-25T10:00:00Z");
    await setStatus(person, form({ text: "Lunch", emoji: "", clear_after: "1h" }), now);
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: person.id } })).status_expires_at;
    await setStatus(person, form({ text: "Lunch break", emoji: "", clear_after: "keep" }), new Date(now.getTime() + 10 * 60_000));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: person.id } });
    assert.equal(after.status_text, "Lunch break");
    assert.equal(after.status_expires_at?.toISOString(), before?.toISOString());

    // Edit person applies the registration name rule, with the same 80-character limit.
    const edit = (extra: Record<string, string | number>) => updatePerson(admin, form({ user_id: person.id, first_name: "Test", last_name: "person", email: prefix + "person@example.test", job_title_id: "", team_id: "", ...extra }));
    await assert.rejects(edit({ first_name: "123 <b>" }), /Letters/);
    await edit({ last_name: "L".repeat(72) });

    // A pending request: the person's new lead may withdraw it; moving the person ends it.
    for (const name of ["a", "b"]) teams.push((await prisma.team.create({ data: { name: prefix + name, name_key: prefix + name } })).id);
    await prisma.user.update({ where: { id: lead1.id }, data: { team_id: teams[0], team_lead: true } });
    await prisma.user.update({ where: { id: lead2.id }, data: { team_id: teams[1], team_lead: true } });
    await prisma.user.update({ where: { id: person.id }, data: { team_id: teams[0] } });
    const { id: requestId } = await mutateTitleRequest(lead1, form({ operation: "request", user_id: person.id, title: prefix + " Analyst" }));
    await prisma.user.update({ where: { id: lead1.id }, data: { team_lead: false } });
    await prisma.user.update({ where: { id: lead2.id }, data: { team_id: teams[0] } });
    await mutateTitleRequest(lead2, form({ operation: "cancel", request_id: requestId }));
    assert.equal(await prisma.jobTitleRequest.count({ where: { id: requestId } }), 0);
    await mutateTitleRequest(lead2, form({ operation: "request", user_id: person.id, title: prefix + " Senior" }));
    await mutateTeam(admin, form({ operation: "assign", user_id: person.id, team_id: teams[1] }));
    assert.equal(await prisma.jobTitleRequest.count({ where: { user_id: person.id, status: "PENDING" } }), 0);

    // Promoted this month: one entry per person, for the title they hold now, in the list's spelling.
    await prisma.user.update({ where: { id: lead2.id }, data: { team_id: teams[1] } });
    for (const title of [prefix + " First", prefix + " SECOND"]) {
      const { id } = await mutateTitleRequest(lead2, form({ operation: "request", user_id: person.id, title }));
      await mutateTitleRequest(admin, form({ operation: "approve", request_id: id }));
    }
    const mine = (await getPromotions(new Date().toISOString().slice(0, 10))).filter((p) => p.personId === person.id);
    assert.equal(mine.length, 1);
    const current = await prisma.user.findUniqueOrThrow({ where: { id: person.id }, include: { job_title: true } });
    assert.equal(mine[0].title, current.job_title?.name);
  } finally {
    await prisma.jobTitleRequest.deleteMany({ where: { user_id: { in: users } } });
    await prisma.absence.deleteMany({ where: { user_id: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    await prisma.jobTitle.deleteMany({ where: { name_key: { startsWith: prefix.toLowerCase() } } });
    await prisma.$disconnect();
  }
});
