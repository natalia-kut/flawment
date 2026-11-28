import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { ApiTokenError, createApiToken } from "../../lib/auth/api-tokens";
import { addDays, workspaceToday } from "../../lib/time-off/dates";
import { GET } from "../../app/api/calendar/[token]/route";

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) data.append(key, item);
  return data;
}

async function feed(token: string) {
  const response = await GET(new Request(`http://localhost:3000/api/calendar/${token}.ics`), { params: Promise.resolve({ token: `${token}.ics` }) });
  // Unfolded, so a long line can be matched whole.
  return { status: response.status, type: response.headers.get("content-type"), body: (await response.text()).replace(/\r\n /g, "") };
}

test("a calendar feed shows your deadlines, project ends and time off, as the app does", async () => {
  const prefix = "cal-test-" + randomUUID().slice(0, 8);
  const today = workspaceToday();
  const day = (offset: number) => new Date(addDays(today, offset));
  const team = await prisma.team.create({ data: { name: prefix, name_key: prefix } });
  const person = (name: string, lead = false) => prisma.user.create({ data: {
    username: prefix + name, email: `${prefix}${name}@example.test`, password: "x", first_name: name, last_name: "Calendar",
    team_id: team.id, team_lead: lead,
  } });
  const lead = await person("Lead", true);
  const member = await person("Member");
  const project = await prisma.project.create({ data: {
    name: prefix + " project", start_date: day(-10), end_date: day(20), owner_id: lead.id,
    memberships: { create: [{ user_id: lead.id, role: "OWNER" }, { user_id: member.id, role: "CONTRIBUTOR" }] },
  } });
  try {
    const task = (title: string, status: "TO_DO" | "COMPLETED", assignee = lead.id) => prisma.task.create({ data: {
      title, status, deadline: day(3), project_id: project.id, created_by: lead.id, assigned_to: assignee,
    } });
    const open = await task("Ship, then; rest", "TO_DO");
    await task(prefix + " done already", "COMPLETED");
    await task(prefix + " someone else's", "TO_DO", member.id);
    await prisma.absence.createMany({ data: [
      { user_id: lead.id, type: "VACATION", start_date: day(5), end_date: day(7) },
      { user_id: member.id, type: "SICK_LEAVE", start_date: day(1), end_date: day(2), note: prefix + " private note" },
    ] });

    // A calendar token does nothing else, since it travels in a link.
    await assert.rejects(createApiToken(lead.id, form({ name: "Both", scopes: ["CALENDAR", "MCP_READ"], days: "30" })), ApiTokenError);
    const { token } = await createApiToken(lead.id, form({ name: "Calendar", scopes: "CALENDAR", days: "30" }));
    const { token: mcpOnly } = await createApiToken(lead.id, form({ name: "MCP", scopes: "MCP_READ", days: "30" }));

    const { status, type, body } = await feed(token);
    assert.equal(status, 200);
    assert.equal(type, "text/calendar; charset=utf-8");
    assert.match(body, new RegExp(`UID:task-${open.id}@localhost:3000`));
    assert.match(body, /SUMMARY:Due: Ship\\, then\\; rest/);
    assert.match(body, new RegExp(`URL:http://localhost:3000/\\?task=${open.id}`));
    assert.match(body, new RegExp(`SUMMARY:Project ends: ${prefix} project`));
    assert.match(body, /SUMMARY:Vacation\r\n/, "your own time off, with its type");
    // The lead sees why their team member is away, as in the app; never the note.
    assert.match(body, /SUMMARY:Member Calendar: Sick leave/);
    assert.equal(body.includes("private note"), false);
    assert.equal(body.includes("done already"), false, "completed tasks are left out");
    assert.equal(body.includes("someone else's"), false, "only your own deadlines");

    // The team member, who does not lead, sees no one else's time off.
    const { token: memberToken } = await createApiToken(member.id, form({ name: "Calendar", scopes: "CALENDAR", days: "30" }));
    const memberFeed = await feed(memberToken);
    assert.match(memberFeed.body, /SUMMARY:Sick leave\r\n/);
    assert.equal(memberFeed.body.includes("Lead Calendar"), false);

    assert.equal((await feed(mcpOnly)).status, 404, "an MCP token is not a calendar link");
    assert.equal((await feed(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).status, 404);
    await prisma.apiToken.deleteMany({ where: { user_id: lead.id } });
    assert.equal((await feed(token)).status, 404, "a revoked token");
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [lead.id, member.id] } } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.$disconnect();
  }
});
