import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createPlannedProject, prepareProjectPlan } from "../../lib/flawiusz/project-plan";
import { runTool } from "../../lib/flawiusz/tools/tool-list";
import { prisma } from "../../lib/prisma";
import { addDays, workspaceToday } from "../../lib/time-off/dates";

test("workspace tools respect project access and apply a reviewed plan atomically", async () => {
  const name = `flawiusz-${randomUUID()}`;
  const users: number[] = [];
  const projects: number[] = [];
  try {
    for (const suffix of ["admin", "member", "outsider"]) {
      const user = await prisma.user.create({ data: {
        username: `${name}-${suffix}`, email: `${name}-${suffix}@example.test`,
        first_name: name, last_name: suffix, password: "unused",
        role: suffix === "admin" ? "SUPER_ADMIN" : "USER",
      } });
      users.push(user.id);
    }
    const [adminId, memberId, outsiderId] = users;
    const admin = { id: adminId, role: "SUPER_ADMIN" } as const;
    const member = { id: memberId, role: "USER" } as const;
    const outsider = { id: outsiderId, role: "USER" } as const;
    const invoke = (actor: typeof admin | typeof member, tool: string, args: unknown) =>
      runTool(tool, args, { actor, chosenProjectId: undefined });
    const today = workspaceToday();
    const monday = addDays(today, -((new Date(today).getUTCDay() + 6) % 7));
    const workDay = addDays(monday, -7);
    const plan = { name, start_date: workDay, end_date: monday, tasks: [{
      title: "Set up the API", description: "Write the first endpoint.", priority: "HIGH",
      deadline: workDay, assignee_id: memberId, work_from: workDay, work_to: workDay,
    }] };

    await assert.rejects(createPlannedProject(member, plan), /Only managers/);
    const draft = await prepareProjectPlan(admin, plan);
    assert.equal(draft.people[0].id, memberId);
    assert.equal(await prisma.project.count({ where: { name } }), 0);

    const absence = await prisma.absence.create({ data: {
      user_id: memberId, type: "VACATION", start_date: new Date(workDay), end_date: new Date(workDay), note: "Private note",
    } });
    const candidates = await invoke(admin, "find_planning_candidates", { from: workDay, to: workDay, search: name });
    assert.ok(candidates.ok);
    assert.equal((candidates.value as { people: { id: number; available: boolean }[] }).people.find((person) => person.id === memberId)?.available, false);
    assert.doesNotMatch(JSON.stringify(candidates.value), /VACATION|Private note/);
    await assert.rejects(createPlannedProject(admin, plan), /away during/);
    assert.equal(await prisma.project.count({ where: { name } }), 0);
    await prisma.absence.delete({ where: { id: absence.id } });

    const project = await createPlannedProject(admin, draft.plan);
    projects.push(project.id);
    assert.equal(await prisma.projectMembership.count({ where: { project_id: project.id } }), 2);
    const task = await prisma.task.findFirstOrThrow({ where: { project_id: project.id } });
    assert.equal(task.assigned_to, memberId);
    const filter = { project_id: project.id, assignee_id: memberId, last_week: true, date_field: "deadline" };
    const listed = await invoke(member, "list_tasks", filter);
    assert.ok(listed.ok);
    assert.deepEqual((listed.value as { tasks: { id: number }[] }).tasks.map(({ id }) => id), [task.id]);
    const hidden = await invoke(outsider, "list_tasks", filter);
    assert.ok(hidden.ok);
    assert.deepEqual((hidden.value as { tasks: unknown[] }).tasks, []);
    assert.equal((await invoke(member, "get_task", { task_id: task.id })).ok, true);
    assert.equal((await invoke(outsider, "get_task", { task_id: task.id })).ok, false);
    assert.equal((await invoke(outsider, "get_project", { project_id: project.id })).ok, false);
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: projects } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
