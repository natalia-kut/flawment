import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { mutateStage } from "../../lib/stages/service";
import { createTask, updateTask } from "../../lib/tasks/service";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("stages support authorized CRUD, task assignment and safe deletion", async () => {
  const prefix = "stage-test-" + randomUUID();
  const users: number[] = [];
  const projects: number[] = [];
  try {
    for (const suffix of ["owner", "manager", "participant", "outsider"]) {
      const user = await prisma.user.create({ data: {
        username: prefix + suffix, email: prefix + suffix + "@example.test",
        password: "unused-test-hash", first_name: "Test", last_name: suffix,
      } });
      users.push(user.id);
    }
    for (const suffix of ["first", "second"]) {
      const project = await prisma.project.create({ data: {
        name: prefix + suffix, start_date: new Date("2026-10-26"), owner_id: users[0],
        memberships: { create: [
          { user_id: users[0], role: "ADMIN" }, { user_id: users[1], role: "MANAGER" },
          { user_id: users[2], role: "PARTICIPANT" },
        ] },
      } });
      projects.push(project.id);
    }
    const actor = (index: number) => ({ id: users[index], role: "USER" as const });
    const stageInput = (extra: Record<string, string | number> = {}) =>
      form({ operation: "create", project_id: projects[0], name: "Planning", ...extra });
    const stage = await mutateStage(actor(0), stageInput({ description: "Initial plan", deadline: "2026-11-01" }));
    assert.equal(stage.description, "Initial plan");
    assert.equal(stage.deadline?.toISOString().slice(0, 10), "2026-11-01");
    await assert.rejects(mutateStage(actor(2), stageInput({ name: "Forbidden" })), /permission/);
    await assert.rejects(mutateStage(actor(3), stageInput()), /permission/);
    await assert.rejects(mutateStage(actor(0), stageInput({ name: " planning " })), /already exists/);
    await assert.rejects(mutateStage(actor(0), stageInput({ name: " " })), /stage name/);
    await assert.rejects(mutateStage(actor(0), stageInput({ deadline: "2026-02-30" })), /deadline/);
    const renamed = await mutateStage(actor(1), stageInput({
      operation: "update", stage_id: stage.id, name: "Implementation", description: "", deadline: "",
    }));
    assert.equal(renamed.name, "Implementation");
    assert.equal(renamed.description, null);
    assert.equal(renamed.deadline, null);
    await assert.rejects(mutateStage(actor(0), stageInput({
      operation: "update", stage_id: stage.id, project_id: projects[1],
    })), /no longer available/);
    const foreignStage = await mutateStage(actor(0), stageInput({ project_id: projects[1] }));
    const taskInput = (extra: Record<string, string | number> = {}) =>
      form({ project_id: projects[0], title: "Implement feature", priority: "MEDIUM", stage_id: stage.id, ...extra });
    const task = await createTask(actor(0), taskInput());
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).stage_id, stage.id);
    await assert.rejects(createTask(actor(0), taskInput({ stage_id: foreignStage.id })), /stage from this project/);
    await assert.rejects(updateTask(actor(1), taskInput({
      task_id: task.id, status: "IN_PROGRESS", stage_id: foreignStage.id,
    })), /stage from this project/);
    await updateTask(actor(1), taskInput({ task_id: task.id, status: "IN_PROGRESS", stage_id: "" }));
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).stage_id, null);
    await updateTask(actor(1), taskInput({ task_id: task.id, status: "COMPLETED" }));
    await assert.rejects(mutateStage(actor(2), stageInput({ operation: "delete", stage_id: stage.id })), /permission/);
    await assert.rejects(mutateStage(actor(0), stageInput({ operation: "delete", stage_id: foreignStage.id })), /no longer available/);
    await mutateStage(actor(1), stageInput({ operation: "delete", stage_id: stage.id }));
    const preserved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(preserved.stage_id, null);
    assert.equal(preserved.status, "COMPLETED");
    await assert.rejects(createTask(actor(0), taskInput()), /stage from this project/);
    await assert.rejects(mutateStage(actor(0), stageInput({ operation: "delete", stage_id: stage.id })), /no longer available/);
    await prisma.user.update({ where: { id: users[3] }, data: { role: "SUPER_ADMIN" } });
    const rootStage = await mutateStage({ id: users[3], role: "SUPER_ADMIN" }, stageInput({ name: "Testing" }));
    assert.equal(rootStage.name, "Testing");
    await prisma.project.delete({ where: { id: projects[0] } });
    assert.equal(await prisma.projectStage.count({ where: { project_id: projects[0] } }), 0);
    assert.equal(await prisma.task.count({ where: { project_id: projects[0] } }), 0);
  } finally {
    if (projects.length) await prisma.project.deleteMany({ where: { id: { in: projects } } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
