import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { changeTaskStatus, createTask, updateTask } from "../../lib/tasks/service";
import { addComment } from "../../lib/tasks/comments";
import { mutateProject } from "../../lib/projects/service";
import { mutateTitleRequest } from "../../lib/job-title-requests/service";
import { getNotifications, markNotificationsRead } from "../../lib/notifications/data";
import { notificationHref, notificationText } from "../../lib/notifications/labels";
import type { Actor } from "../../lib/rbac";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

const actorOf = (user: { id: number; role: Actor["role"] }): Actor => ({ id: user.id, role: user.role });
const texts = async (user: { id: number; role: Actor["role"] }) =>
  (await getNotifications(actorOf(user))).items.map((item) => { const t = notificationText(item); return `${t.who} ${t.text} ${t.what}`; });

test("changes to your work notify you, never the person who made them", async () => {
  const prefix = "notify-" + randomUUID().slice(0, 8);
  const team = await prisma.team.create({ data: { name: prefix, name_key: prefix } });
  const person = (name: string, extra: object = {}) => prisma.user.create({ data: {
    username: prefix + name, email: `${prefix}${name}@example.test`, password: "x", first_name: name, last_name: "Test", team_id: team.id, ...extra,
  } });
  const owner = await person("Olga", { team_lead: true });
  const worker = await person("Wit");
  const outsider = await person("Ula");
  const admin = await person("Ada", { role: "SUPER_ADMIN", team_id: null });
  const project = await prisma.project.create({ data: {
    name: prefix + " site", start_date: new Date("2026-01-01"), owner_id: owner.id,
    memberships: { create: [{ user_id: owner.id, role: "OWNER" }] },
  } });
  try {
    // Added to a project.
    await mutateProject(actorOf(owner), form({ operation: "add", project_id: project.id, user_id: worker.id, role: "CONTRIBUTOR" }));
    assert.deepEqual(await texts(worker), [`Olga Test added you to ${prefix} site`]);
    assert.deepEqual(await texts(owner), [], "not told of their own change");

    // Assigned, then the status moved by the owner, then by the worker.
    const task = await createTask(actorOf(owner), form({ project_id: project.id, title: "Ship it", priority: "HIGH", assigned_to: worker.id }));
    await changeTaskStatus(actorOf(owner), form({ project_id: project.id, task_id: task.id, status: "IN_PROGRESS", expected_status: "TO_DO" }));
    await changeTaskStatus(actorOf(worker), form({ project_id: project.id, task_id: task.id, status: "IN_REVIEW", expected_status: "IN_PROGRESS" }));
    assert.deepEqual((await texts(worker)).slice(0, 2), ["Olga Test moved to In progress: Ship it", "Olga Test assigned you Ship it"]);
    assert.deepEqual(await texts(owner), ["Wit Test moved to To review: Ship it"]);

    // A status changed in the task form counts too.
    await updateTask(actorOf(owner), form({ project_id: project.id, task_id: task.id, title: "Ship it", priority: "HIGH", assigned_to: worker.id, status: "COMPLETED" }));
    assert.equal((await texts(worker))[0], "Olga Test moved to Done: Ship it");

    // A comment reaches the assignee and creator; a reply also reaches whoever was answered.
    const question = await addComment(actorOf(worker), form({ task_id: task.id, body: "Done?" }));
    assert.equal((await texts(owner))[0], "Wit Test commented on Ship it");
    await addComment(actorOf(owner), form({ task_id: task.id, parent_id: question.id, body: "Yes" }));
    assert.equal((await texts(worker))[0], "Olga Test commented on Ship it");
    assert.deepEqual(await texts(outsider), [], "no one outside the work hears of it");

    // Losing access to the project hides its notifications.
    const before = await getNotifications(actorOf(worker));
    assert.equal(notificationHref(before.items[0]), `/?task=${task.id}`);
    await mutateProject(actorOf(owner), form({ operation: "remove", project_id: project.id, user_id: worker.id }));
    assert.deepEqual(await texts(worker), []);
    await mutateProject(actorOf(owner), form({ operation: "add", project_id: project.id, user_id: worker.id, role: "CONTRIBUTOR" }));

    // Reading: your own only, one by one or all.
    const { unread, items } = await getNotifications(actorOf(worker));
    assert.ok(unread >= 5);
    assert.equal(await markNotificationsRead(owner.id, [items[0].id]), 0, "someone else's notification");
    assert.equal(await markNotificationsRead(worker.id, [items[0].id]), 1);
    assert.equal((await getNotifications(actorOf(worker))).unread, unread - 1);
    await markNotificationsRead(worker.id, "all");
    assert.equal((await getNotifications(actorOf(worker))).unread, 0);

    // A job title request reaches administrators; the decision reaches the lead who asked.
    await mutateTitleRequest(actorOf(owner), form({ operation: "request", user_id: worker.id, title: prefix + " Senior" }));
    assert.equal((await texts(admin))[0], `Olga Test suggests a new job title for Wit Test: ${prefix} Senior`);
    const request = await prisma.jobTitleRequest.findFirstOrThrow({ where: { user_id: worker.id } });
    await mutateTitleRequest(actorOf(admin), form({ operation: "decline", request_id: request.id }));
    const decided = (await getNotifications(actorOf(owner))).items[0];
    assert.equal(notificationText(decided).text, "declined your suggestion for Wit Test:");
    assert.equal(notificationHref(decided), "/?view=team");
  } finally {
    await prisma.jobTitleRequest.deleteMany({ where: { user_id: worker.id } });
    await prisma.jobTitle.deleteMany({ where: { name: prefix + " Senior" } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, worker.id, outsider.id, admin.id] } } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.$disconnect();
  }
});
