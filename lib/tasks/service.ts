import { can, type Actor } from "@/lib/rbac";
import { normalizeNewlines } from "@/lib/rich-text/markdown";
import { MAX_DESCRIPTION_LENGTH } from "./limits";
import type { Task, TaskPriority, TaskStatus } from "@/src/generated/prisma/client";
import { serializable } from "@/lib/transaction";
import { keepUnchanged, knowsBase, listFields, staleFields } from "@/lib/stale";

export class TaskError extends Error {}
/** The page was out of date: someone changed what it was about to save. */
export class TaskConflictError extends TaskError {}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function recordId(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new TaskError("Invalid record ID.");
  }
  return Number(value);
}

export const taskStatuses: TaskStatus[] = ["TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"];

export async function createTask(actor: Actor, data: FormData) {
  return saveTask(actor, data, false);
}

export async function updateTask(actor: Actor, data: FormData) {
  return saveTask(actor, data, true);
}

const patchable = ["title", "description", "priority", "deadline", "assigned_to", "stage_id"];

/**
 * Changes only the fields in the form, so a page that was open for a while does not
 * overwrite what someone else changed since. The status has its own rules: `changeTaskStatus`.
 */
export async function patchTask(actor: Actor, data: FormData) {
  if (!patchable.some((key) => data.has(key))) throw new TaskError("There is nothing to change.");
  return saveTask(actor, data, true, true);
}

/** The task's values as a form would send them. */
function formValues(task: Task): Record<string, string> {
  return {
    title: task.title, description: normalizeNewlines(task.description ?? ""), priority: task.priority, status: task.status,
    deadline: task.deadline?.toISOString().slice(0, 10) ?? "",
    assigned_to: task.assigned_to?.toString() ?? "", stage_id: task.stage_id?.toString() ?? "",
  };
}

/** The task's own values, with the submitted ones over them: a whole form out of a partial one. */
function completeForm(data: FormData, task: Task) {
  const whole = new FormData();
  for (const [key, value] of Object.entries(formValues(task))) whole.set(key, patchable.includes(key) && data.has(key) ? text(data, key) : value);
  return whole;
}

// Pages that may be out of date: see lib/stale.ts.
const fieldNames: Record<string, string> = {
  title: "title", description: "description", priority: "priority", deadline: "deadline",
  assigned_to: "assignee", stage_id: "stage", status: "status",
};
const sameValue = (key: string, a: string, b: string) => key === "description" ? normalizeNewlines(a) === normalizeNewlines(b) : a === b;

function checkNotStale(data: FormData, task: Task) {
  const stale = staleFields(data, formValues(task), sameValue);
  if (stale.length === 0) return;
  throw new TaskConflictError(`Someone changed the ${listFields(stale.map((key) => fieldNames[key]))} of this task in the meantime. Your version is still here: check it and save again to keep it.`);
}

/** When a task is finished or reopened, its completion date follows; otherwise it stays as it was. */
function completion(status: TaskStatus, previous?: TaskStatus) {
  if (status === previous) return {};
  return { completed_at: status === "COMPLETED" ? new Date() : null };
}

function readFields(data: FormData, editing: boolean) {
  // A new task starts in the board column it was created from, or "To do".
  const status = (text(data, "status") || (editing ? "" : "TO_DO")) as TaskStatus;
  if (!taskStatuses.includes(status)) throw new TaskError("Choose a valid task status.");
  const stageValue = text(data, "stage_id");
  const stageId = stageValue ? recordId(stageValue) : null;
  const title = text(data, "title");
  // Forms submit line breaks as \r\n.
  const description = normalizeNewlines(text(data, "description"));
  const priority = text(data, "priority") as TaskPriority;
  const deadline = text(data, "deadline");
  const assignedValue = text(data, "assigned_to");
  const assignedTo = assignedValue ? recordId(assignedValue) : null;
  if (!title || title.length > 150) throw new TaskError("Enter a title between 1 and 150 characters.");
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new TaskError(`Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters, formatting included.`);
  if (!priorities.includes(priority)) throw new TaskError("Choose a valid priority.");
  if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(Date.parse(deadline)) ||
      new Date(deadline).toISOString().slice(0, 10) !== deadline)) {
    throw new TaskError("Enter a valid deadline.");
  }
  return { status, stageId, title, description, priority, deadline, assignedTo };
}

async function saveTask(actor: Actor, data: FormData, editing: boolean, partial = false) {
  const taskId = editing ? recordId(text(data, "task_id")) : null;
  const projectId = recordId(text(data, "project_id"));
  const submitted = partial ? null : readFields(data, editing);

  return serializable(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId }, include: { memberships: true },
    });
    const role = project?.memberships.find((m) => m.user_id === actor.id)?.role ?? null;
    if (!project || !can(role, "tasks:create", actor.role)) {
      throw new TaskError("You do not have permission to add tasks to this project.");
    }
    const manages = can(role, "tasks:manage", actor.role);
    const existing = taskId === null ? null
      : await tx.task.findFirst({ where: { id: taskId, project_id: projectId } });
    if (taskId !== null && !existing) throw new TaskError("This task is no longer available in this project.");
    // Contributors edit the tasks they added, and hand work only to themselves.
    if (!manages && existing && existing.created_by !== actor.id) throw new TaskError("You can only edit tasks you added.");
    if (existing) checkNotStale(data, existing);
    const { status, stageId, title, description, priority, deadline, assignedTo } =
      partial ? readFields(completeForm(data, existing!), true)
      : existing && knowsBase(data, Object.keys(fieldNames)) ? readFields(keepUnchanged(data, formValues(existing), sameValue), true)
      : submitted!;
    if (!manages && assignedTo !== null && assignedTo !== actor.id && assignedTo !== existing?.assigned_to) {
      throw new TaskError("You can assign tasks only to yourself.");
    }
    // An assignee left as they were is not checked again: renaming a task must not fail because they since left.
    if (assignedTo !== null && !(existing && assignedTo === existing.assigned_to)) {
      const member = await tx.projectMembership.findUnique({
        where: { project_id_user_id: { project_id: projectId, user_id: assignedTo } },
        include: { user: { select: { is_active: true, role: true } } },
      });
      if (!member || !member.user.is_active || member.user.role !== "USER") {
        throw new TaskError("Choose an active project member.");
      }
    }
    if (stageId !== null && !await tx.projectStage.findFirst({ where: { id: stageId, project_id: projectId }, select: { id: true } })) {
      throw new TaskError("Choose a stage from this project.");
    }
    const values = {
      ...completion(status, existing?.status),
      stage_id: stageId,
      title, description: description || null, priority,
      deadline: deadline ? new Date(deadline) : null,
      assigned_to: assignedTo, status,
    };
    if (taskId !== null) {
      return tx.task.update({
        where: { id: taskId, project_id: projectId },
        data: values, select: { id: true },
      });
    }
    return tx.task.create({
      data: { ...values, project_id: projectId, created_by: actor.id },
      select: { id: true },
    });
  });
}

export async function deleteTask(actor: Actor, data: FormData) {
  const projectId = recordId(text(data, "project_id"));
  const taskId = recordId(text(data, "task_id"));
  return serializable(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId }, include: { memberships: true },
    });
    const role = project?.memberships.find((member) => member.user_id === actor.id)?.role ?? null;
    if (!project || !can(role, "tasks:create", actor.role)) {
      throw new TaskError("You do not have permission to delete tasks in this project.");
    }
    // Contributors may delete only the tasks they added.
    if (!can(role, "tasks:manage", actor.role)) {
      const task = await tx.task.findFirst({ where: { id: taskId, project_id: projectId }, select: { created_by: true } });
      if (task && task.created_by !== actor.id) throw new TaskError("You can only delete tasks you added.");
    }
    const deleted = await tx.task.deleteMany({
      where: { id: taskId, project_id: projectId },
    });
    if (deleted.count !== 1) {
      throw new TaskError("This task is no longer available in this project.");
    }
  });
}

export async function changeTaskStatus(actor: Actor, data: FormData) {
  const projectId = recordId(text(data, "project_id"));
  const taskId = recordId(text(data, "task_id"));
  const status = text(data, "status") as TaskStatus;
  const expected = text(data, "expected_status") as TaskStatus;
  if (!taskStatuses.includes(status) || !taskStatuses.includes(expected)) {
    throw new TaskError("Choose a valid task status.");
  }
  return serializable(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, project_id: projectId },
      include: { project: { include: { memberships: true } } },
    });
    if (!task) throw new TaskError("This task is no longer available in this project.");
    const role = task.project.memberships.find((member) => member.user_id === actor.id)?.role ?? null;
    const allowed = can(role, "tasks:manage", actor.role) ||
      ((task.assigned_to === actor.id || task.created_by === actor.id) && can(role, "tasks:own", actor.role));
    if (!allowed) throw new TaskError("You do not have permission to change this task status.");
    const changed = await tx.task.updateMany({
      where: { id: taskId, project_id: projectId, status: expected },
      data: { status, ...completion(status, expected) },
    });
    if (changed.count !== 1) throw new TaskError("Someone changed this task in the meantime. Check its status and try again.");
  });
}
