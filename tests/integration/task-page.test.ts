import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { createTask, patchTask } from "../../lib/tasks/service";
import { addComment, deleteComment, editComment } from "../../lib/tasks/comments";
import { MAX_COMMENT_LENGTH } from "../../lib/tasks/limits";
import { getTaskDetails } from "../../lib/tasks/details";

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("a task page saves single fields and holds a discussion, each within its permissions", async () => {
  const prefix = "task-page-test-" + randomUUID();
  const users: number[] = [];
  let projectId: number | undefined;
  try {
    for (const suffix of ["owner", "coordinator", "contributor", "outsider", "admin"]) {
      const user = await prisma.user.create({ data: {
        username: prefix + suffix, email: prefix + suffix + "@example.test", password: "unused-test-hash",
        first_name: "Test", last_name: suffix, role: suffix === "admin" ? "SUPER_ADMIN" : "USER",
      } });
      users.push(user.id);
    }
    const [owner, coordinator, contributor, outsider] = users.map((id) => ({ id, role: "USER" as const }));
    const admin = { id: users[4], role: "SUPER_ADMIN" as const };
    const project = await prisma.project.create({ data: {
      name: prefix, start_date: new Date("2026-10-25"), owner_id: owner.id,
      memberships: { create: [
        { user_id: owner.id, role: "OWNER" },
        { user_id: coordinator.id, role: "COORDINATOR" },
        { user_id: contributor.id, role: "CONTRIBUTOR" },
      ] },
    } });
    projectId = project.id;
    const { id } = await createTask(owner, form({
      project_id: project.id, title: "Original", description: "Text", priority: "MEDIUM", deadline: "2026-12-01", assigned_to: contributor.id,
    }));
    const read = () => prisma.task.findUniqueOrThrow({ where: { id } });
    const patch = (fields: Record<string, string | number>) => form({ project_id: project.id, task_id: id, ...fields });

    // Only the submitted field changes.
    await patchTask(coordinator, patch({ priority: "URGENT" }));
    let task = await read();
    assert.deepEqual([task.title, task.description, task.priority, task.assigned_to, task.deadline?.toISOString().slice(0, 10), task.status],
      ["Original", "Text", "URGENT", contributor.id, "2026-12-01", "TO_DO"]);
    await patchTask(owner, patch({ deadline: "" }));
    await patchTask(owner, patch({ description: "" }));
    task = await read();
    assert.equal(task.deadline, null);
    assert.equal(task.description, null);
    assert.equal(task.title, "Original");

    // The status is not a plain field, and an empty form changes nothing.
    await assert.rejects(patchTask(owner, patch({ status: "COMPLETED" })), /nothing to change/);
    await patchTask(owner, patch({ title: "Renamed", status: "COMPLETED" }));
    task = await read();
    assert.equal(task.title, "Renamed");
    assert.equal(task.status, "TO_DO");

    // The same rules as the full form.
    await assert.rejects(patchTask(owner, patch({ title: " " })), /title/);
    await assert.rejects(patchTask(owner, patch({ priority: "INVALID" })), /priority/);
    await assert.rejects(patchTask(owner, patch({ deadline: "2026-02-30" })), /deadline/);
    await assert.rejects(patchTask(owner, patch({ assigned_to: outsider.id })), /active project member/);
    await assert.rejects(patchTask(owner, patch({ stage_id: "999999999" })), /stage from this project/);
    await assert.rejects(patchTask(contributor, patch({ title: "Mine now" })), /only edit tasks you added/);
    await assert.rejects(patchTask(outsider, patch({ title: "Mine now" })), /permission/);
    await assert.rejects(patchTask(owner, patch({ task_id: "999999999", title: "Nowhere" })), /no longer available/);

    // A deactivated assignee does not block other changes, but cannot be picked.
    await prisma.user.update({ where: { id: contributor.id }, data: { is_active: false } });
    await patchTask(owner, patch({ title: "Still editable" }));
    assert.equal((await read()).assigned_to, contributor.id);
    await patchTask(owner, patch({ assigned_to: "" }));
    await assert.rejects(patchTask(owner, patch({ assigned_to: contributor.id })), /active project member/);
    await prisma.user.update({ where: { id: contributor.id }, data: { is_active: true } });

    // Every member (and a super admin) joins the discussion; nobody else does.
    const say = (body: string) => form({ task_id: id, body });
    const first = await addComment(contributor, say("  First\r\nline two  "));
    const second = await addComment(admin, say("From IT"));
    const third = await addComment(owner, say("Third"));
    await assert.rejects(addComment(outsider, say("Hello")), /no longer available/);
    await assert.rejects(addComment(owner, form({ task_id: "999999999", body: "Hello" })), /no longer available/);
    await assert.rejects(addComment(owner, say(" \n ")), /Write a comment/);
    await assert.rejects(addComment(owner, say("x".repeat(MAX_COMMENT_LENGTH + 1))), /up to 5000/);

    const seen = await getTaskDetails(contributor, id);
    assert.deepEqual(seen?.comments.map((comment) => [comment.body, comment.mine]), [["First\nline two", true], ["From IT", false], ["Third", false]]);
    assert.deepEqual([seen?.comments[1].author.id, seen?.comments[1].author.firstName], [null, "Administrator"], "super admins stay anonymous");
    assert.equal((await getTaskDetails(admin, id))?.comments[1].author.id, admin.id);
    assert.equal(await getTaskDetails(outsider, id), null);

    // Authors edit their own; authors and whoever runs the tasks delete.
    const change = (commentId: number, body = "") => form({ comment_id: commentId, body });
    await editComment(contributor, change(first.id, "Edited"));
    const edited = await prisma.taskComment.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(edited.body, "Edited");
    assert.ok(edited.edited_at);
    await assert.rejects(editComment(owner, change(first.id, "Not mine")), /only edit your own/);
    await assert.rejects(deleteComment(contributor, change(third.id)), /only delete your own/);
    await assert.rejects(deleteComment(outsider, change(third.id)), /no longer available/);
    await deleteComment(coordinator, change(third.id));
    await deleteComment(admin, change(second.id));
    await assert.rejects(deleteComment(admin, change(second.id)), /no longer available/);

    // Replies make one-level threads; a deleted comment keeps its place while it has some.
    const root = await addComment(owner, say("Question"));
    const reply = (parent: number, body: string) => form({ task_id: id, parent_id: parent, body });
    const answer = await addComment(contributor, reply(root.id, "Answer"));
    const followUp = await addComment(owner, reply(answer.id, "Follow-up"));
    const thread = async () => (await getTaskDetails(contributor, id))?.comments.find((comment) => comment.id === root.id);
    assert.deepEqual((await thread())?.replies.map((item) => [item.id, item.body]), [[answer.id, "Answer"], [followUp.id, "Follow-up"]]);
    const otherTask = await createTask(owner, form({ project_id: project.id, title: "Other", priority: "LOW" }));
    await assert.rejects(addComment(owner, form({ task_id: otherTask.id, parent_id: root.id, body: "Wrong task" })), /replying to/);
    await assert.rejects(addComment(outsider, reply(root.id, "Hello")), /no longer available/);
    await deleteComment(owner, change(root.id));
    const placeholder = await thread();
    assert.deepEqual([placeholder?.deleted, placeholder?.body, placeholder?.author.id, placeholder?.replies.length], [true, "", null, 2]);
    assert.equal((await prisma.taskComment.findUniqueOrThrow({ where: { id: root.id } })).body, "", "the text is really gone");
    await assert.rejects(editComment(owner, change(root.id, "Back")), /no longer available/);
    await assert.rejects(addComment(owner, reply(root.id, "Too late")), /replying to/);
    await addComment(owner, reply(answer.id, "Still open through the replies"));
    for (const item of (await thread())!.replies) await deleteComment(coordinator, change(item.id));
    assert.equal(await prisma.taskComment.findUnique({ where: { id: root.id } }), null, "the last reply removes the placeholder");

    // Leaving the project ends the access, not the comment.
    await prisma.projectMembership.delete({ where: { project_id_user_id: { project_id: project.id, user_id: contributor.id } } });
    await assert.rejects(editComment(contributor, change(first.id, "Too late")), /no longer available/);
    await assert.rejects(deleteComment(contributor, change(first.id)), /no longer available/);
    assert.equal(await getTaskDetails(contributor, id), null);
    await prisma.user.delete({ where: { id: contributor.id } });
    assert.equal((await getTaskDetails(owner, id))?.comments[0].author.firstName, "Former");

    // The discussion goes with its task.
    await prisma.task.delete({ where: { id } });
    assert.equal(await prisma.taskComment.count({ where: { task_id: id } }), 0);
  } finally {
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
