import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { createTask, patchTask, updateTask, TaskConflictError } from "../../lib/tasks/service";
import { mutateProject, ProjectConflictError } from "../../lib/projects/service";
import { mutateTitleRequest } from "../../lib/job-title-requests/service";
import { mutateTeam } from "../../lib/teams/service";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("pages that are out of date keep newer changes and refuse clashes", async () => {
  const prefix = "stale-test-" + randomUUID().slice(0, 8);
  const users: number[] = [];
  const teams: number[] = [];
  let projectId: number | undefined;
  try {
    for (const suffix of ["owner", "coord", "admin", "lead", "person"]) {
      const user = await prisma.user.create({ data: {
        username: prefix + suffix, email: prefix + suffix + "@example.test", password: "unused-test-hash",
        first_name: "Test", last_name: suffix, role: suffix === "admin" ? "SUPER_ADMIN" : "USER",
      } });
      users.push(user.id);
    }
    const [owner, coord, admin] = [0, 1, 2].map((index) => ({ id: users[index], role: index === 2 ? "SUPER_ADMIN" as const : "USER" as const }));
    const project = await prisma.project.create({ data: {
      name: prefix, start_date: new Date("2026-11-01"), owner_id: owner.id,
      memberships: { create: [{ user_id: owner.id, role: "OWNER" }, { user_id: coord.id, role: "COORDINATOR" }] },
    } });
    projectId = project.id;

    // Task dialog: the owner's page still shows To do / Medium; the coordinator has since completed it.
    const { id: taskId } = await createTask(owner, form({ project_id: projectId, title: "Report", priority: "MEDIUM" }));
    const ids = { project_id: projectId, task_id: taskId };
    await updateTask(coord, form({ ...ids, title: "Report", priority: "URGENT", status: "COMPLETED", deadline: "2026-12-24" }));
    const stalePage = { expected_title: "Report", expected_description: "", expected_status: "TO_DO", expected_priority: "MEDIUM", expected_deadline: "", expected_assigned_to: "", expected_stage_id: "" };
    await updateTask(owner, form({ ...ids, ...stalePage, title: "Report renamed", description: "", status: "TO_DO", priority: "MEDIUM", deadline: "", assigned_to: "", stage_id: "" }));
    let task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    assert.equal(task.title, "Report renamed", "the field the owner changed is saved");
    assert.equal(task.status, "COMPLETED", "fields the owner left alone keep the newer values");
    assert.equal(task.priority, "URGENT");
    assert.equal(task.deadline?.toISOString().slice(0, 10), "2026-12-24");
    assert.ok(task.completed_at, "the completion date stays");

    // Both changed the same field: refused, nothing written.
    await assert.rejects(updateTask(owner, form({ ...ids, ...stalePage, title: "Report renamed", description: "", status: "TO_DO", priority: "LOW", deadline: "", assigned_to: "", stage_id: "" })),
      (error) => error instanceof TaskConflictError && /priority and deadline|priority/.test(error.message));
    task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    assert.equal(task.priority, "URGENT");

    // Task page: a description saved from an old copy, or a checkbox ticked on one.
    await patchTask(coord, form({ ...ids, description: "- [ ] one\n- [ ] two\n\nIMPORTANT", expected_description: "" }));
    await assert.rejects(patchTask(owner, form({ ...ids, description: "- [ ] one\n- [x] two", expected_description: "- [ ] one\n- [ ] two" })), TaskConflictError);
    await patchTask(owner, form({ ...ids, description: "- [ ] one\n- [x] two\n\nIMPORTANT", expected_description: "- [ ] one\r\n- [ ] two\r\n\r\nIMPORTANT" }));
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).description, "- [ ] one\n- [x] two\n\nIMPORTANT");

    // Edit project: the coordinator moved it on; the owner's old form changes only the description.
    const projectForm = { operation: "update", project_id: projectId, name: prefix, start_date: "2026-11-01", end_date: "", status: "TO_DO", description: "" };
    const projectBase = { expected_name: prefix, expected_start_date: "2026-11-01", expected_end_date: "", expected_status: "TO_DO", expected_description: "" };
    await mutateProject(coord, form({ ...projectForm, status: "IN_PROGRESS", end_date: "2026-12-31" }));
    await mutateProject(owner, form({ ...projectForm, ...projectBase, description: "Plan" }));
    const saved = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(saved.description, "Plan");
    assert.equal(saved.status, "IN_PROGRESS");
    assert.equal(saved.end_date?.toISOString().slice(0, 10), "2026-12-31");
    await assert.rejects(mutateProject(owner, form({ ...projectForm, ...projectBase, status: "COMPLETED" })), ProjectConflictError);

    // Teams: a card shows the person in the first team, but they have moved to the second.
    for (const name of ["a", "b"]) teams.push((await prisma.team.create({ data: { name: prefix + name, name_key: prefix + name } })).id);
    const [lead, person] = [users[3], users[4]];
    await prisma.user.update({ where: { id: lead }, data: { team_id: teams[0], team_lead: true } });
    await prisma.user.update({ where: { id: person }, data: { team_id: teams[1] } });
    await assert.rejects(mutateTeam(admin, form({ operation: "lead", user_id: person, team_lead: "on", expected_team_id: teams[0] })), /moved to another team/);
    await assert.rejects(mutateTeam(admin, form({ operation: "assign", user_id: person, team_id: "", expected_team_id: teams[0] })), /moved to another team/);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: person } })).team_id, teams[1]);

    // Job title request: the lead replaces the suggestion while the administrator is reading it.
    await prisma.user.update({ where: { id: person }, data: { team_id: teams[0] } });
    const leadActor = { id: lead, role: "USER" as const };
    const { id: requestId } = await mutateTitleRequest(leadActor, form({ operation: "request", user_id: person, title: prefix + " Junior" }));
    await mutateTitleRequest(leadActor, form({ operation: "request", user_id: person, title: prefix + " Head" }));
    await assert.rejects(mutateTitleRequest(admin, form({ operation: "approve", request_id: requestId, expected_title: prefix + " Junior" })), /changed to/);
    assert.equal((await prisma.jobTitleRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "PENDING");
    await mutateTitleRequest(admin, form({ operation: "decline", request_id: requestId, expected_title: prefix + " Head" }));
    assert.equal((await prisma.jobTitleRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "DECLINED");
  } finally {
    await prisma.jobTitleRequest.deleteMany({ where: { user_id: { in: users } } });
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.team.deleteMany({ where: { id: { in: teams } } });
    await prisma.$disconnect();
  }
});
