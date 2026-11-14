import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { mutateTitleRequest } from "../../lib/job-title-requests/service";
import { getLeadTitleRequests, getPendingTitleRequests, getPromotions } from "../../lib/job-title-requests/data";
import { workspaceToday } from "../../lib/time-off/dates";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("team leads suggest job titles for their people and a super admin decides", async () => {
  const prefix = "titles-" + randomUUID();
  const users: number[] = [], teams: number[] = [];
  try {
    const team = await prisma.team.create({ data: { name: prefix, name_key: prefix } });
    const other = await prisma.team.create({ data: { name: prefix + " other", name_key: prefix + " other" } });
    teams.push(team.id, other.id);
    const manager = await prisma.jobTitle.create({ data: { name: `${prefix} Manager`, name_key: `${prefix} manager`, can_lead: true } });
    const make = async (suffix: string, extra: object = {}) => {
      const user = await prisma.user.create({ data: { username: prefix + suffix, email: `${prefix}${suffix}@example.test`, password: "test-unused", first_name: suffix, last_name: "Test", ...extra } });
      users.push(user.id);
      return { id: user.id, role: (user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER") as "SUPER_ADMIN" | "USER" };
    };
    const lead = await make("lead", { team_id: team.id, team_lead: true, job_title_id: manager.id });
    const member = await make("member", { team_id: team.id, job_title_id: manager.id, team_lead: false });
    const peer = await make("peer", { team_id: team.id });
    const outsider = await make("outsider", { team_id: other.id });
    const root = await make("root", { role: "SUPER_ADMIN" });
    const request = (actor: typeof lead, userId: number, title: string, note = "") =>
      mutateTitleRequest(actor, form({ operation: "request", user_id: userId, title, note }));

    // Only the team's lead asks, for someone else in their team, for a real change.
    await assert.rejects(request(peer, member.id, "Designer"), /Only the lead/);
    await assert.rejects(request(lead, outsider.id, "Designer"), /Only the lead/);
    await assert.rejects(request(lead, lead.id, "Designer"), /Only the lead/);
    await assert.rejects(request(lead, member.id, `${prefix} MANAGER`), /already their job title/);
    await assert.rejects(request(lead, member.id, "x".repeat(81)), /between 1 and 80/);

    // One request waits per person: a second suggestion replaces the first.
    const first = await request(lead, member.id, `${prefix} Designer`);
    const second = await request(lead, member.id, `${prefix} Senior designer`, "Took over the design system");
    assert.equal(second.id, first.id);
    const pending = await getPendingTitleRequests(root);
    const mine = pending.find((r) => r.id === first.id)!;
    assert.equal(mine.title, `${prefix} Senior designer`);
    assert.equal(mine.note, "Took over the design system");
    assert.equal(mine.isNewTitle, true);
    assert.equal(mine.canLead, false);
    assert.equal(await getPendingTitleRequests(lead).then((r) => r.length), 0, "only a super admin sees the queue");
    assert.equal((await getLeadTitleRequests(lead)).byPerson[member.id]?.status, "PENDING");

    // Only a super admin decides; approving adds the new title and sets it.
    await assert.rejects(mutateTitleRequest(lead, form({ operation: "approve", request_id: first.id })), /Only administrators/);
    await mutateTitleRequest(root, form({ operation: "approve", request_id: first.id }));
    const approved = await prisma.user.findUniqueOrThrow({ where: { id: member.id }, include: { job_title: true } });
    assert.equal(approved.job_title?.name, `${prefix} Senior designer`);
    await assert.rejects(mutateTitleRequest(root, form({ operation: "decline", request_id: first.id })), /already been dealt with/);
    // Everyone sees this month's promotions; the decision is stamped now, so "this month" is today's.
    assert.deepEqual((await getPromotions(workspaceToday())).filter((r) => r.personId === member.id).map((r) => r.title), [`${prefix} Senior designer`]);

    // A lead withdraws their own request; a declined one leaves the title alone.
    const withdrawn = await request(lead, peer.id, `${prefix} Tester`);
    await assert.rejects(mutateTitleRequest(peer, form({ operation: "cancel", request_id: withdrawn.id })), /your own requests/);
    await mutateTitleRequest(lead, form({ operation: "cancel", request_id: withdrawn.id }));
    assert.equal(await prisma.jobTitleRequest.count({ where: { id: withdrawn.id } }), 0);
    const declined = await request(lead, peer.id, `${prefix} Tester`);
    await mutateTitleRequest(root, form({ operation: "decline", request_id: declined.id }));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: peer.id } })).job_title_id, null);

    // Approving a title that cannot lead ends a lead role, and the card says so first.
    await prisma.user.update({ where: { id: member.id }, data: { team_lead: true, job_title_id: manager.id } });
    const demotion = await request(lead, member.id, `${prefix} Senior designer`);
    assert.equal((await getPendingTitleRequests(root)).find((r) => r.id === demotion.id)?.endsLead, true);
    await mutateTitleRequest(root, form({ operation: "approve", request_id: demotion.id }));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).team_lead, false);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    await prisma.jobTitle.deleteMany({ where: { name_key: { startsWith: prefix.toLowerCase() } } });
    await prisma.$disconnect();
  }
});
