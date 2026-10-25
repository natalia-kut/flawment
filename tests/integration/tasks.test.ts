import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { createTask } from "../../lib/tasks/service";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("task creation validates project permissions, assignees and input", async () => {
  const prefix = "task-test-" + randomUUID();
  const users: number[] = [];
  let projectId: number | undefined;
  try {
    for (const suffix of ["owner", "manager", "participant", "outsider"]) {
      const user = await prisma.user.create({ data: {
        username: prefix + suffix, email: prefix + suffix + "@example.test",
        password: "unused-test-hash", first_name: "Test", last_name: suffix,
      } });
      users.push(user.id);
    }
    const project = await prisma.project.create({ data: {
      name: prefix, start_date: new Date("2026-10-25"), owner_id: users[0],
      memberships: { create: [
        { user_id: users[0], role: "ADMIN" },
        { user_id: users[1], role: "MANAGER" },
        { user_id: users[2], role: "PARTICIPANT" },
      ] },
    } });
    projectId = project.id;
    const actor = (index: number) => ({ id: users[index], role: "USER" as const });
    const input = (extra: Record<string, string | number> = {}) =>
      form({ project_id: project.id, title: "Prepare report", priority: "MEDIUM", ...extra });

    const created = await createTask(actor(0), input({ assigned_to: users[2], deadline: "2026-11-01" }));
    const saved = await prisma.task.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(saved.assigned_to, users[2]);
    assert.equal(saved.created_by, users[0]);
    assert.equal(saved.status, "TO_DO");
    assert.equal(saved.deadline?.toISOString().slice(0, 10), "2026-11-01");
    const unassigned = await createTask(actor(1), input());
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: unassigned.id } })).assigned_to, null);

    await assert.rejects(createTask(actor(2), input()), /permission/);
    await assert.rejects(createTask(actor(3), input()), /permission/);
    await assert.rejects(createTask(actor(0), input({ assigned_to: users[3] })), /active project member/);
    await prisma.user.update({ where: { id: users[2] }, data: { is_active: false } });
    await assert.rejects(createTask(actor(0), input({ assigned_to: users[2] })), /active project member/);
    await assert.rejects(createTask(actor(0), input({ title: " " })), /title/);
    await assert.rejects(createTask(actor(0), input({ priority: "INVALID" })), /priority/);
    await assert.rejects(createTask(actor(0), input({ deadline: "2026-02-30" })), /deadline/);
    assert.equal(await prisma.task.count({ where: { project_id: project.id } }), 2);
  } finally {
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});

