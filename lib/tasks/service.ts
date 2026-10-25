import { prisma } from "@/lib/prisma";
import { can, type Actor } from "@/lib/rbac";
import type { TaskPriority } from "@/src/generated/prisma/client";

export class TaskError extends Error {}

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function recordId(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new TaskError("Invalid record ID.");
  }
  return Number(value);
}

export async function createTask(actor: Actor, data: FormData) {
  const projectId = recordId(text(data, "project_id"));
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
      throw new TaskError("You do not have permission to create tasks in this project.");
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
    const task = await tx.task.create({
      data: {
        project_id: projectId, title, description: description || null,
        priority, deadline: deadline ? new Date(deadline) : null,
        assigned_to: assignedTo, created_by: actor.id, status: "TO_DO",
      },
      select: { id: true },
    });
    return task;
  }, { isolationLevel: "Serializable" });
}
