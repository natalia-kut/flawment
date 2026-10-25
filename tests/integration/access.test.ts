import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { registerAccount, authenticate } from "../../lib/auth/service";
import { mutateProject } from "../../lib/projects/service";
import { visibleProjects, type Actor } from "../../lib/rbac";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, String(value)));
  return data;
}

test("registration, login and project authorization against PostgreSQL", async () => {
  const prefix = `test-${randomUUID().slice(0, 8)}`;
  const userIds: number[] = [];
  const projectIds: number[] = [];
  const emails: string[] = [];
  async function account(suffix: string): Promise<Actor> {
    const email = `${prefix}-${suffix}@example.test`;
    emails.push(email);
    const result = await registerAccount(form({ username: `${prefix}-${suffix}`, email, first_name: "Test", last_name: suffix,
      password: "TestPassword123!", confirm_password: "TestPassword123!", role: "SUPER_ADMIN" }));
    assert.equal(result.error, undefined);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    userIds.push(user.id);
    assert.equal(user.role, "USER", "registration cannot elevate the account role");
    assert.notEqual(user.password, "TestPassword123!");
    return { id: user.id, role: user.role };
  }
  try {
    const owner = await account("owner");
    const member = await account("member");
    const manager = await account("manager");
    const outsider = await account("outsider");
    const root = await account("root");
    await prisma.user.update({ where: { id: root.id }, data: { role: "SUPER_ADMIN" } });
    root.role = "SUPER_ADMIN";

    assert.equal((await authenticate(form({ email: emails[0].toUpperCase(), password: "TestPassword123!" }))).userId, owner.id);
    assert.equal((await authenticate(form({ email: emails[0], password: "wrong" }))).error, "Invalid email address or password.");
    assert.ok((await registerAccount(form({ username: `${prefix}-OWNER`, email: emails[0].toUpperCase(), first_name: "Duplicate", last_name: "Test", password: "TestPassword123!", confirm_password: "TestPassword123!" }))).error);
    await prisma.user.update({ where: { id: outsider.id }, data: { is_active: false } });
    assert.equal((await authenticate(form({ email: emails[3], password: "TestPassword123!" }))).error, "Invalid email address or password.");
    await prisma.user.update({ where: { id: outsider.id }, data: { is_active: true } });

    const created = await mutateProject(owner, form({ operation: "create", name: prefix, status: "TO_DO", start_date: "2026-10-25" }));
    assert.ok("owner_id" in created);
    const projectId = created.id;
    projectIds.push(projectId);
    const change = (operation: string, extra: Record<string, string | number> = {}) => form({ operation, project_id: projectId, ...extra });
    assert.equal((await prisma.projectMembership.findUniqueOrThrow({ where: { project_id_user_id: { project_id: projectId, user_id: owner.id } } })).role, "ADMIN");
    assert.equal(await prisma.project.count({ where: { id: projectId, ...visibleProjects(outsider) } }), 0);
    await assert.rejects(mutateProject(outsider, change("delete")), /permission/);
    await mutateProject(owner, change("add", { user_id: member.id, role: "PARTICIPANT" }));
    await assert.rejects(mutateProject(owner, change("add", { user_id: member.id, role: "PARTICIPANT" })), /already/);
    assert.equal(await prisma.user.count({ where: { id: member.id, memberships: { none: { project_id: projectId } } } }), 0);
    assert.equal(await prisma.project.count({ where: { id: projectId, ...visibleProjects(member) } }), 1);
    await assert.rejects(mutateProject(member, change("add", { user_id: outsider.id, role: "ADMIN" })), /permission/);
    await assert.rejects(mutateProject(member, change("delete")), /permission/);
    await mutateProject(owner, change("add", { user_id: manager.id, role: "MANAGER" }));
    await assert.rejects(mutateProject(manager, change("add", { user_id: outsider.id, role: "ADMIN" })), /elevated/);
    await assert.rejects(mutateProject(manager, change("role", { user_id: member.id, role: "ADMIN" })), /permission/);
    await assert.rejects(mutateProject(manager, change("delete")), /permission/);
    await mutateProject(manager, change("update", { name: "Updated", status: "IN_PROGRESS", start_date: "2026-10-25" }));
    await mutateProject(owner, change("role", { user_id: member.id, role: "ADMIN" }));
    await assert.rejects(mutateProject(manager, change("remove", { user_id: member.id })), /only remove/);
    await assert.rejects(mutateProject(owner, change("remove", { user_id: owner.id })), /owner/);
    await assert.rejects(mutateProject(root, change("role", { user_id: owner.id, role: "PARTICIPANT" })), /owner/);
    await mutateProject(owner, change("role", { user_id: member.id, role: "PARTICIPANT" }));
    await prisma.task.create({ data: { title: prefix, project_id: projectId, created_by: owner.id, assigned_to: member.id } });
    await mutateProject(manager, change("remove", { user_id: member.id }));
    assert.equal((await prisma.task.findFirstOrThrow({ where: { project_id: projectId } })).assigned_to, null);
    assert.equal(await prisma.project.count({ where: { id: projectId, ...visibleProjects(member) } }), 0);
    await assert.rejects(mutateProject(member, change("update", { name: "Denied", status: "TO_DO", start_date: "2026-10-25" })), /permission/);
    await mutateProject(root, change("delete"));
    assert.equal(await prisma.task.count({ where: { project_id: projectId } }), 0);
    assert.equal(await prisma.projectMembership.count({ where: { project_id: projectId } }), 0);

    const ownProject = await mutateProject(owner, form({ operation: "create", name: `${prefix}-delete`, status: "TO_DO", start_date: "2026-10-25" }));
    projectIds.push(ownProject.id);
    await mutateProject(owner, form({ operation: "delete", project_id: ownProject.id }));
    assert.equal(await prisma.project.count({ where: { id: ownProject.id } }), 0);

    for (let i = 0; i < 11; i++) await authenticate(form({ email: emails[0], password: "wrong" }));
    assert.match((await authenticate(form({ email: emails[0], password: "TestPassword123!" }))).error ?? "", /Too many/);
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.loginAttempt.deleteMany({ where: { key: { in: emails.map((email) => createHash("sha256").update(email).digest("hex")) } } });
    await prisma.$disconnect();
  }
});
