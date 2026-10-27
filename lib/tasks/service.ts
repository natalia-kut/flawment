import { prisma } from "@/lib/prisma";
import { can, type Actor } from "@/lib/rbac";
import type { TaskPriority, TaskStatus } from "@/src/generated/prisma/client";

export class TaskError extends Error {}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function recordId(value: string) {
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

async function saveTask(actor: Actor, data: FormData, editing: boolean) {
  const taskId = editing ? recordId(text(data, "task_id")) : null;
  const status = editing ? text(data, "status") as TaskStatus : "TO_DO";
  if (!taskStatuses.includes(status)) throw new TaskError("Choose a valid task status.");
  const projectId = recordId(text(data, "project_id"));
  const stageValue = text(data, "stage_id");
  const stageId = stageValue ? recordId(stageValue) : null;
  const title = text(data, "title");
  const description = text(data, "description");
  const priority = text(data, "priority") as TaskPriority;
  const deadline = text(data, "deadline");
  const assignedValue = text(data, "assigned_to");
  const assignedTo = assignedValue ? recordId(assignedValue) : null;
  if (!title || title.length > 150) throw new TaskError("Enter a title between 1 and 150 characters.");
  if (description.length > 5000) throw new TaskError("Description must not exceed 5000 characters.");
  if (!priorities.includes(priority)) throw new TaskError("Choose a valid priority.");
  if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(Date.parse(deadline)) ||
      new Date(deadline).toISOString().slice(0, 10) !== deadline)) {
    throw new TaskError("Enter a valid deadline.");
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId }, include: { memberships: true },
    });
    const role = project?.memberships.find((m) => m.user_id === actor.id)?.role ?? null;
    if (!project || !can(role, "tasks:manage", actor.role)) {
      throw new TaskError("You do not have permission to manage tasks in this project.");
    }
    if (taskId !== null) {
      const existing = await tx.task.findFirst({ where: { id: taskId, project_id: projectId }, select: { id: true } });
      if (!existing) throw new TaskError("This task is no longer available in this project.");
    }
    if (assignedTo !== null) {
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
  }, { isolationLevel: "Serializable" });
}

export async function deleteTask(actor: Actor, data: FormData) {
  const projectId = recordId(text(data, "project_id"));
  const taskId = recordId(text(data, "task_id"));
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId }, include: { memberships: true },
    });
    const role = project?.memberships.find((member) => member.user_id === actor.id)?.role ?? null;
    if (!project || !can(role, "tasks:manage", actor.role)) {
      throw new TaskError("You do not have permission to delete tasks in this project.");
    }
    const deleted = await tx.task.deleteMany({
      where: { id: taskId, project_id: projectId },
    });
    if (deleted.count !== 1) {
      throw new TaskError("This task is no longer available in this project.");
    }
  }, { isolationLevel: "Serializable" });
}

export async function changeTaskStatus(actor: Actor, data: FormData) {
  const projectId = recordId(text(data, "project_id"));
  const taskId = recordId(text(data, "task_id"));
  const status = text(data, "status") as TaskStatus;
  const expected = text(data, "expected_status") as TaskStatus;
  if (!taskStatuses.includes(status) || !taskStatuses.includes(expected)) {
    throw new TaskError("Choose a valid task status.");
  }
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, project_id: projectId },
      include: { project: { include: { memberships: true } } },
    });
    if (!task) throw new TaskError("This task is no longer available in this project.");
    const role = task.project.memberships.find((member) => member.user_id === actor.id)?.role ?? null;
    const allowed = can(role, "tasks:manage", actor.role) ||
      (task.assigned_to === actor.id && can(role, "tasks:update-assigned", actor.role));
    if (!allowed) throw new TaskError("You do not have permission to change this task status.");
    const changed = await tx.task.updateMany({
      where: { id: taskId, project_id: projectId, status: expected },
      data: { status },
    });
    if (changed.count !== 1) throw new TaskError("This task changed. Refresh the board and try again.");
  }, { isolationLevel: "Serializable" });
}
