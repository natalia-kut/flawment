import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { createTask, updateTask, deleteTask, changeTaskStatus } from "../../lib/tasks/service";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("task creation, editing and deletion enforce permissions and project boundaries", async () => {
  const prefix = "task-test-" + randomUUID();
  const users: number[] = [];
  let projectId: number | undefined;
  let otherProjectId: number | undefined;
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

    const editInput = (extra: Record<string, string | number> = {}) =>
      input({ task_id: created.id, status: "IN_PROGRESS", ...extra });
    await updateTask(actor(1), editInput({
      title: "Updated report", description: "Updated description", priority: "HIGH",
      deadline: "2026-12-01", assigned_to: users[1],
    }));
    const edited = await prisma.task.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(edited.title, "Updated report");
    assert.equal(edited.description, "Updated description");
    assert.equal(edited.priority, "HIGH");
    assert.equal(edited.deadline?.toISOString().slice(0, 10), "2026-12-01");
    assert.equal(edited.assigned_to, users[1]);
    assert.equal(edited.status, "IN_PROGRESS");
    assert.equal(edited.created_by, users[0], "editing preserves the original author");
    for (const status of ["TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"]) {
      await updateTask(actor(0), editInput({ status }));
      assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: created.id } })).status, status);
    }
    const cleared = await prisma.task.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(cleared.assigned_to, null);
    assert.equal(cleared.deadline, null);
    assert.equal(cleared.description, null);
    await assert.rejects(updateTask(actor(2), editInput()), /permission/);
    await assert.rejects(updateTask(actor(3), editInput()), /permission/);
    await assert.rejects(updateTask(actor(0), editInput({ status: "INVALID" })), /status/);
    await assert.rejects(updateTask(actor(0), editInput({ title: " " })), /title/);
    await assert.rejects(updateTask(actor(0), editInput({ priority: "INVALID" })), /priority/);
    await assert.rejects(updateTask(actor(0), editInput({ deadline: "2026-02-30" })), /deadline/);
    await assert.rejects(updateTask(actor(0), editInput({ assigned_to: users[3] })), /active project member/);
    const otherProject = await prisma.project.create({ data: {
      name: prefix + "-other", start_date: new Date("2026-10-25"), owner_id: users[0],
      memberships: { create: { user_id: users[0], role: "ADMIN" } },
    } });
    otherProjectId = otherProject.id;
    await assert.rejects(updateTask(actor(0), editInput({ project_id: otherProject.id })), /no longer available/);
    await assert.rejects(updateTask(actor(0), editInput({ task_id: "999999999" })), /no longer available/);
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: created.id } })).status, "CANCELLED", "rejected updates do not change the task");
    await assert.rejects(createTask(actor(2), input()), /permission/);
    await assert.rejects(createTask(actor(3), input()), /permission/);
    await assert.rejects(createTask(actor(0), input({ assigned_to: users[3] })), /active project member/);
    await prisma.user.update({ where: { id: users[2] }, data: { is_active: false } });
    await assert.rejects(createTask(actor(0), input({ assigned_to: users[2] })), /active project member/);
    await assert.rejects(updateTask(actor(0), editInput({ assigned_to: users[2] })), /active project member/);
    await assert.rejects(createTask(actor(0), input({ title: " " })), /title/);
    await assert.rejects(createTask(actor(0), input({ priority: "INVALID" })), /priority/);
    await assert.rejects(createTask(actor(0), input({ deadline: "2026-02-30" })), /deadline/);
    assert.equal(await prisma.task.count({ where: { project_id: project.id } }), 2);
    await prisma.user.update({ where: { id: users[2] }, data: { is_active: true } });
    await updateTask(actor(0), editInput({ status: "TO_DO", assigned_to: users[2], title: "Board task" }));
    const statusInput = (extra: Record<string, string | number> = {}) =>
      form({ project_id: project.id, task_id: created.id, status: "IN_PROGRESS", expected_status: "TO_DO", ...extra });
    await changeTaskStatus(actor(2), statusInput());
    const moved = await prisma.task.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(moved.status, "IN_PROGRESS");
    assert.equal(moved.title, "Board task");
    assert.equal(moved.assigned_to, users[2]);
    await assert.rejects(changeTaskStatus(actor(2), statusInput()), /changed/);
    await assert.rejects(changeTaskStatus(actor(3), statusInput({ expected_status: "IN_PROGRESS" })), /permission/);
    await assert.rejects(changeTaskStatus(actor(2), statusInput({ task_id: unassigned.id })), /permission/);
    await assert.rejects(changeTaskStatus(actor(0), statusInput({ project_id: otherProject.id })), /no longer available/);
    await assert.rejects(changeTaskStatus(actor(0), statusInput({ status: "INVALID" })), /valid task status/);
    await changeTaskStatus(actor(1), statusInput({ expected_status: "IN_PROGRESS", status: "IN_REVIEW" }));
    await changeTaskStatus(actor(0), statusInput({ expected_status: "IN_REVIEW", status: "COMPLETED" }));
    assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: created.id } })).status, "COMPLETED");
    await prisma.projectMembership.delete({ where: { project_id_user_id: { project_id: project.id, user_id: users[2] } } });
    await assert.rejects(changeTaskStatus(actor(2), statusInput({ expected_status: "COMPLETED" })), /permission/);
    const deletion = (extra: Record<string, string | number> = {}) =>
      form({ project_id: project.id, task_id: created.id, ...extra });
    await assert.rejects(deleteTask(actor(2), deletion()), /permission/);
    await assert.rejects(deleteTask(actor(3), deletion()), /permission/);
    await assert.rejects(deleteTask(actor(0), deletion({ project_id: otherProject.id })), /no longer available/);
    await assert.rejects(deleteTask(actor(0), deletion({ task_id: "invalid" })), /Invalid record ID/);
    await assert.rejects(deleteTask(actor(0), deletion({ task_id: "999999999" })), /no longer available/);
    assert.equal(await prisma.task.count({ where: { project_id: project.id } }), 2, "rejected deletions preserve tasks");
    await deleteTask(actor(1), deletion());
    assert.equal(await prisma.task.findUnique({ where: { id: created.id } }), null);
    assert.ok(await prisma.task.findUnique({ where: { id: unassigned.id } }), "other tasks remain");
    await assert.rejects(deleteTask(actor(0), deletion()), /no longer available/);
    await deleteTask(actor(0), deletion({ task_id: unassigned.id }));
    assert.equal(await prisma.task.count({ where: { project_id: project.id } }), 0);
    const rootTask = await createTask(actor(0), input());
    await prisma.user.update({ where: { id: users[3] }, data: { role: "SUPER_ADMIN" } });
    await deleteTask({ id: users[3], role: "SUPER_ADMIN" }, deletion({ task_id: rootTask.id }));
    assert.equal(await prisma.task.findUnique({ where: { id: rootTask.id } }), null);
    assert.ok(await prisma.project.findUnique({ where: { id: project.id } }), "deleting tasks preserves the project");
  } finally {
    if (otherProjectId) await prisma.project.deleteMany({ where: { id: otherProjectId } });
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
