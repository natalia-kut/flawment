import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../../lib/prisma";
import { mutateTeam } from "../../lib/teams/service";
import { getTeamsOverview } from "../../lib/teams/data";
import { mutateTimeOff } from "../../lib/time-off/service";
import { updateProfile, updateProfileField, profileVisibility } from "../../lib/profiles/service";
import { setStatus } from "../../lib/status/service";
import { setJobTitleCanLead, updatePerson } from "../../lib/people/service";
import { getCalendarTimeOff } from "../../lib/time-off/calendar";
import { findAvailableMembers } from "../../lib/projects/service";
import { addDays } from "../../lib/time-off/dates";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("teams, birthdays and time off respect who may see and change them", async () => {
  const prefix = "team-" + randomUUID();
  const today = "2026-11-12";
  const users: number[] = [], teams: number[] = [], projects: number[] = [];
  try {
    for (const suffix of ["anna", "ben", "outsider", "root", "lead"]) {
      const user = await prisma.user.create({ data: { username: prefix + suffix, email: `${prefix}${suffix}@example.test`, password: "test-unused", first_name: suffix, last_name: "Test", role: suffix === "root" ? "SUPER_ADMIN" : "USER" } });
      users.push(user.id);
    }
    const person = (id: number, changes: Record<string, string | number>) => {
      const index = users.indexOf(id);
      const suffix = ["anna", "ben", "outsider", "root", "lead"][index];
      return form({ user_id: id, first_name: suffix, last_name: "Test", email: `${prefix}${suffix}@example.test`, ...changes });
    };
    const actor = (index: number) => ({ id: users[index], role: index === 3 ? "SUPER_ADMIN" as const : "USER" as const });
    const [anna, ben, outsider, root, lead] = [0, 1, 2, 3, 4].map(actor);

    // Teams: only a super admin shapes them.
    await assert.rejects(mutateTeam(anna, form({ operation: "create", name: prefix })), /Only administrators/);
    const team = await mutateTeam(root, form({ operation: "create", name: `  ${prefix}  Frontend ` })) as { id: number; name: string };
    teams.push(team.id);
    assert.equal(team.name, `${prefix} Frontend`);
    await assert.rejects(mutateTeam(root, form({ operation: "create", name: `${prefix} FRONTEND` })), /already exists/);
    await assert.rejects(mutateTeam(root, form({ operation: "assign", user_id: root.id, team_id: team.id })), /standard user/);
    await assert.rejects(mutateTeam(anna, form({ operation: "assign", user_id: anna.id, team_id: team.id })), /Only administrators/);
    for (const user of [anna, ben, lead]) await mutateTeam(root, form({ operation: "assign", user_id: user.id, team_id: team.id }));
    await assert.rejects(mutateTeam(root, form({ operation: "lead", user_id: outsider.id, team_lead: "on" })), /in a team/);
    await assert.rejects(mutateTeam(lead, form({ operation: "lead", user_id: lead.id, team_lead: "on" })), /Only administrators/);
    // Only a managerial job title can lead; a super admin picks titles from the list (or adds one).
    await assert.rejects(mutateTeam(root, form({ operation: "lead", user_id: lead.id, team_lead: "on" })), /managerial/);
    await updatePerson(root, person(lead.id, { job_title_id: "new", new_job_title: `${prefix} Manager`, team_id: team.id }));
    await mutateTeam(root, form({ operation: "lead", user_id: lead.id, team_lead: "on" }));

    // Teammates see each other (photos included); outsiders do not.
    assert.equal(await prisma.user.count({ where: profileVisibility(anna, ben.id) }), 1);
    assert.equal(await prisma.user.count({ where: profileVisibility(outsider, ben.id) }), 1, "anyone may see who is in which team");
    assert.equal(await prisma.user.count({ where: profileVisibility(outsider, root.id) }), 0, "super admins stay out of the directory");

    // Birthdays: the year stays on the server.
    await updateProfileField(ben, "birth_date", "1994-11-13");
    await assert.rejects(updateProfileField(ben, "birth_date", "2999-01-01"), /date of birth/);
    await assert.rejects(updateProfileField(ben, "birth_date", "1994-02-30"), /date of birth/);

    // Time off: only your own, no overlaps, and colleagues never learn the type or note.
    await mutateTimeOff(ben, form({ operation: "create", type: "SICK_LEAVE", start_date: today, end_date: addDays(today, 2), note: "Flu" }), today);
    await assert.rejects(mutateTimeOff(ben, form({ operation: "create", type: "VACATION", start_date: addDays(today, 2), end_date: addDays(today, 4) }), today), /already have time off/);
    await assert.rejects(mutateTimeOff(ben, form({ operation: "create", type: "VACATION", start_date: addDays(today, 5), end_date: addDays(today, 4) }), today), /before the first day/);
    await assert.rejects(mutateTimeOff(ben, form({ operation: "create", type: "NAP", start_date: today }), today), /type/);
    await mutateTimeOff(ben, form({ operation: "create", type: "BUSINESS_TRIP", start_date: addDays(today, 3), end_date: addDays(today, 5) }), today);
    const [first] = await prisma.absence.findMany({ where: { user_id: ben.id }, orderBy: { start_date: "asc" } });
    await assert.rejects(mutateTimeOff(anna, form({ operation: "delete", absence_id: first.id }), today), /no longer exists/);

    const overview = await getTeamsOverview(anna, today);
    assert.equal(overview.canManage, false);
    const seen = overview.people.find((p) => p.id === ben.id)!;
    assert.deepEqual(seen.availability, { state: "away", until: addDays(today, 5), label: "Out of office until 17 Nov" });
    assert.deepEqual(seen.birthday, { label: "13 November", inDays: 1 });
    assert.ok(!JSON.stringify(overview).includes("1994") && !JSON.stringify(overview).includes("Flu") && !JSON.stringify(overview).includes("SICK"));
    // The team lead and super admins learn why; nobody but Ben reads his note.
    const asLead = (await getTeamsOverview(lead, today)).people.find((p) => p.id === ben.id)!;
    assert.deepEqual(asLead.availability?.reasons, ["SICK_LEAVE", "BUSINESS_TRIP"]);
    assert.deepEqual((await getTeamsOverview(root, today)).people.find((p) => p.id === ben.id)!.availability?.reasons, ["SICK_LEAVE", "BUSINESS_TRIP"]);
    assert.ok(!JSON.stringify(await getTeamsOverview(lead, today)).includes("Flu"));
    // Calendar: your own time off, plus your team's when you lead it.
    const leadsCalendar = await getCalendarTimeOff(lead, today);
    assert.deepEqual(leadsCalendar.filter((e) => e.name.startsWith("ben")).map((e) => e.type), ["SICK_LEAVE", "BUSINESS_TRIP"]);
    assert.ok(!JSON.stringify(leadsCalendar).includes("Flu"), "notes never reach the calendar");
    assert.deepEqual(await getCalendarTimeOff(anna, today), [], "a teammate who does not lead sees only their own");
    assert.equal((await getCalendarTimeOff(ben, today)).every((e) => e.mine), true);
    const leadsProject = await prisma.project.create({ data: { name: prefix + " lead", start_date: new Date(today), owner_id: outsider.id } });
    projects.push(leadsProject.id);
    const leadViewer = { id: lead.id, role: "USER", team_id: team.id, team_lead: true };
    const pickedByLead = await findAvailableMembers(leadsProject.id, today, leadViewer);
    assert.equal(pickedByLead.find((c) => c.id === ben.id)?.availability?.reasons?.[0], "SICK_LEAVE");
    const pickedByOutsider = await findAvailableMembers(leadsProject.id, today, { id: outsider.id, role: "USER", team_id: null, team_lead: false });
    assert.equal(pickedByOutsider.find((c) => c.id === ben.id)?.availability?.reasons, undefined);
    const outsiders = await getTeamsOverview(outsider, today);
    assert.equal(outsiders.myTeamId, null, "someone without a team has no team of their own");
    assert.equal(outsiders.canManage, false);
    const benAsOutsider = outsiders.teams.find((t) => t.id === team.id)?.members.find((p) => p.id === ben.id);
    assert.equal(benAsOutsider?.availability?.state, "away", "other teams are visible");
    assert.equal(benAsOutsider?.availability?.reasons, undefined, "but not why someone outside your team is away");
    assert.ok((await getTeamsOverview(root, today)).people.some((p) => p.id === outsider.id && p.teamId === null));

    // Picking people for a project shows who is away.
    const project = await prisma.project.create({ data: { name: prefix, start_date: new Date(today), owner_id: anna.id, memberships: { create: { user_id: anna.id, role: "OWNER" } } } });
    projects.push(project.id);
    const candidates = await findAvailableMembers(project.id, today);
    assert.equal(candidates.find((c) => c.id === ben.id)?.availability?.state, "away");
    assert.equal(candidates.find((c) => c.id === outsider.id)?.availability, null);

    await mutateTimeOff(ben, form({ operation: "delete", absence_id: first.id }), today);
    assert.equal((await findAvailableMembers(project.id, today)).find((c) => c.id === ben.id)?.availability?.state, "soon");

    // Profile details: validated, with skills de-duplicated.
    await updateProfileField(ben, "skills", "Testing, testing ,Playwright,,");
    await updateProfileField(ben, "phone", "+48 600 100 200");
    await assert.rejects(updateProfileField(ben, "job_title", "CEO"), /cannot be changed/);
    await assert.rejects(updateProfileField(root, "job_title", "CEO"), /cannot be changed/, "titles come from the People page, even for a super admin");
    // Statuses: your own, one emoji, cleared on request.
    await setStatus(ben, form({ operation: "set", emoji: "🍽️", text: " Lunch ", clear_after: "1h" }));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ben.id } })).status_text, "Lunch");
    await assert.rejects(setStatus(ben, form({ operation: "set", emoji: "🍽️🚗", text: "x", clear_after: "1h" })), /single emoji/);
    await assert.rejects(setStatus(ben, form({ operation: "set", text: "x", clear_after: "forever" })), /when to clear/);
    await setStatus(ben, form({ operation: "clear" }));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ben.id } })).status_text, null);
    await assert.rejects(updateProfileField(ben, "role", "SUPER_ADMIN"), /cannot be changed/);
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer();
    const photoForm = form({ job_title: "CEO" });
    photoForm.set("photo", new File([new Uint8Array(png)], "me.png", { type: "image/png" }));
    await updateProfile(ben, photoForm);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ben.id } })).phone, "+48 600 100 200", "a photo upload keeps contact details");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ben.id } })).job_title_id, null, "people cannot set their own job title");
    await assert.rejects(updatePerson(ben, person(ben.id, { job_title_id: "new", new_job_title: "CEO" })), /Only administrators/);
    await updatePerson(root, person(ben.id, { job_title_id: "new", new_job_title: ` ${prefix}  QA  engineer `, team_id: team.id }));
    const details = await prisma.user.findUniqueOrThrow({ where: { id: ben.id }, include: { job_title: true } });
    assert.equal(details.job_title?.name, `${prefix} QA engineer`);
    assert.equal(details.job_title?.can_lead, false);
    await assert.rejects(updatePerson(root, person(ben.id, { job_title_id: details.job_title_id!, team_id: team.id, team_lead: "on" })), /managerial/);
    await assert.rejects(updatePerson(root, person(ben.id, { email: `${prefix}anna@example.test` })), /already uses this email/);
    await updatePerson(root, person(root.id, { team_id: team.id }));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: root.id } })).team_id, null, "super admins stay out of teams");
    // A super admin corrects a title the name guessed wrong; a team has one lead, so a new one takes over.
    const isLead = async (id: number) => (await prisma.user.findUniqueOrThrow({ where: { id } })).team_lead;
    await assert.rejects(setJobTitleCanLead(anna, form({ job_title_id: details.job_title_id!, can_lead: "on" })), /Only administrators/);
    await setJobTitleCanLead(root, form({ job_title_id: details.job_title_id!, can_lead: "on" }));
    await updatePerson(root, person(ben.id, { job_title_id: details.job_title_id!, team_id: team.id, team_lead: "on" }));
    assert.equal(await isLead(ben.id), true);
    assert.equal(await isLead(lead.id), false, "the previous lead hands over");
    // Taking the managerial flag away ends the lead role of everyone with that title.
    await setJobTitleCanLead(root, form({ job_title_id: details.job_title_id! }));
    assert.equal(await isLead(ben.id), false);
    await mutateTeam(root, form({ operation: "lead", user_id: lead.id, team_lead: "on" }));
    assert.deepEqual(details.skills, ["Testing", "Playwright"]);
    await assert.rejects(updateProfileField(ben, "phone", "call me"), /phone/);
    await assert.rejects(updateProfileField(ben, "skills", Array.from({ length: 16 }, (_, i) => "s" + i).join(",")), /15 skills/);

    // Moving to another team ends leading the old one.
    const other = await mutateTeam(root, form({ operation: "create", name: prefix + " Other" })) as { id: number };
    teams.push(other.id);
    await mutateTeam(root, form({ operation: "assign", user_id: lead.id, team_id: other.id }));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: lead.id } })).team_lead, false);

    // Deleting a team leaves its people unassigned.
    await mutateTeam(root, form({ operation: "delete", team_id: team.id }));
    teams.splice(teams.indexOf(team.id), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ben.id } })).team_id, null);
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: projects } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    await prisma.jobTitle.deleteMany({ where: { name_key: { startsWith: prefix.toLowerCase() } } });
    await prisma.$disconnect();
  }
});
