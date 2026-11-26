import { can, type Actor } from "@/lib/rbac";
import { normalizeNewlines } from "@/lib/rich-text/markdown";
import type { Prisma } from "@/src/generated/prisma/client";
import { MAX_COMMENT_LENGTH } from "./limits";
import { recordId, TaskError } from "./service";
import { serializable } from "@/lib/transaction";

const field = (data: FormData, key: string) => String(data.get(key) ?? "");

function readBody(data: FormData) {
  // Forms submit line breaks as \r\n.
  const body = normalizeNewlines(field(data, "body")).trim();
  if (!body) throw new TaskError("Write a comment first.");
  if (body.length > MAX_COMMENT_LENGTH) throw new TaskError(`A comment can have up to ${MAX_COMMENT_LENGTH} characters, formatting included.`);
  return body;
}

async function roleIn(tx: Prisma.TransactionClient, actor: Actor, projectId: number) {
  const member = await tx.projectMembership.findUnique({
    where: { project_id_user_id: { project_id: projectId, user_id: actor.id } }, select: { role: true },
  });
  return member?.role ?? null;
}

/** Everyone who sees a task may join its discussion. With `parent_id`, the comment is a reply. */
export async function addComment(actor: Actor, data: FormData) {
  const taskId = recordId(field(data, "task_id"));
  const parentId = field(data, "parent_id") ? recordId(field(data, "parent_id")) : null;
  const body = readBody(data);
  return serializable(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId }, select: { project_id: true } });
    if (!task || !can(await roleIn(tx, actor, task.project_id), "project:read", actor.role)) {
      throw new TaskError("This task is no longer available.");
    }
    const parent = parentId === null ? null
      : await tx.taskComment.findFirst({ where: { id: parentId, task_id: taskId, deleted_at: null }, select: { id: true, parent_id: true } });
    if (parentId !== null && !parent) throw new TaskError("The comment you are replying to is no longer available.");
    return tx.taskComment.create({
      // Threads are one level deep: a reply to a reply joins the same thread.
      data: { task_id: taskId, author_id: actor.id, body, parent_id: parent ? parent.parent_id ?? parent.id : null },
      select: { id: true },
    });
  });
}

/** The comment, for someone who can still see its task. */
async function findComment(tx: Prisma.TransactionClient, actor: Actor, data: FormData) {
  const comment = await tx.taskComment.findFirst({
    where: { id: recordId(field(data, "comment_id")), deleted_at: null },
    select: { id: true, author_id: true, parent_id: true, task: { select: { project_id: true } }, _count: { select: { replies: true } } },
  });
  const role = comment && await roleIn(tx, actor, comment.task.project_id);
  if (!comment || !can(role, "project:read", actor.role)) throw new TaskError("This comment is no longer available.");
  return { comment, role };
}

/** Only the author changes what they wrote. */
export async function editComment(actor: Actor, data: FormData) {
  const body = readBody(data);
  return serializable(async (tx) => {
    const { comment } = await findComment(tx, actor, data);
    if (comment.author_id !== actor.id) throw new TaskError("You can only edit your own comments.");
    return tx.taskComment.update({ where: { id: comment.id }, data: { body, edited_at: new Date() }, select: { id: true } });
  });
}

/** The author, or whoever runs the project's tasks. Other people's replies stay. */
export async function deleteComment(actor: Actor, data: FormData) {
  return serializable(async (tx) => {
    const { comment, role } = await findComment(tx, actor, data);
    if (comment.author_id !== actor.id && !can(role, "tasks:manage", actor.role)) {
      throw new TaskError("You can only delete your own comments.");
    }
    if (comment._count.replies > 0) {
      // The text really goes; only the place in the discussion remains.
      await tx.taskComment.update({ where: { id: comment.id }, data: { body: "", deleted_at: new Date() } });
      return;
    }
    await tx.taskComment.delete({ where: { id: comment.id } });
    // The last reply takes its deleted comment's placeholder with it.
    if (comment.parent_id !== null) {
      await tx.taskComment.deleteMany({ where: { id: comment.parent_id, deleted_at: { not: null }, replies: { none: {} } } });
    }
  });
}
