import { prisma } from "@/lib/prisma";
import { can, type Actor, type Permission } from "@/lib/rbac";
import type { Prisma, ProjectRole, ProjectStatus } from "@/src/generated/prisma/client";

export class ProjectError extends Error {}
const roles: ProjectRole[] = ["ADMIN", "MANAGER", "PARTICIPANT"];
const statuses: ProjectStatus[] = ["TO_DO", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"];
const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
function id(value: string) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) throw new ProjectError("Invalid record ID.");
  return result;
}
function projectInput(data: FormData) {
  const name = field(data, "name"), description = field(data, "description");
  const status = field(data, "status") as ProjectStatus;
  const start = field(data, "start_date"), end = field(data, "end_date");
  const validDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!name || name.length > 120 || description.length > 4000) throw new ProjectError("Enter a project name (up to 120 characters) and description (up to 4000). ");
  if (!statuses.includes(status)) throw new ProjectError("Invalid project status.");
  if (!validDay(start) || (end && (!validDay(end) || end < start))) throw new ProjectError("Enter valid dates; the end date cannot precede the start date.");
  return { name, description: description || null, status, start_date: new Date(start), end_date: end ? new Date(end) : null };
}

async function authorize(tx: Prisma.TransactionClient, actor: Actor, projectId: number, permission: Permission) {
  const project = await tx.project.findUnique({ where: { id: projectId }, include: { memberships: true } });
  const role = project?.memberships.find((member) => member.user_id === actor.id)?.role ?? null;
  if (!project || !can(role, permission, actor.role)) throw new ProjectError("You do not have permission to change this project.");
  return { project, role };
}

// Only called from authenticated server actions. Recheck permissions inside the mutation transaction.
export async function mutateProject(actor: Actor, data: FormData) {
  return prisma.$transaction(async (tx) => {
    const operation = field(data, "operation");
    if (operation === "create") {
      return tx.project.create({ data: { ...projectInput(data), owner_id: actor.id, memberships: { create: { user_id: actor.id, role: "ADMIN" } } } });
    }
    const projectId = id(field(data, "project_id"));
    const permission = operation === "delete" ? "project:delete" : operation === "update" ? "project:update" : operation === "role" ? "members:roles" : "members:manage";
    const { project, role: actorRole } = await authorize(tx, actor, projectId, permission);
    if (operation === "delete") return tx.project.delete({ where: { id: projectId } });
    if (operation === "update") return tx.project.update({ where: { id: projectId }, data: projectInput(data) });
    if (!["add", "remove", "role"].includes(operation)) throw new ProjectError("Unknown project operation.");
    const userId = id(field(data, "user_id"));
    if (userId === project.owner_id) throw new ProjectError("The project owner must remain its admin.");
    const member = project.memberships.find((m) => m.user_id === userId);
    if (operation === "add" || operation === "role") {
      const role = field(data, "role") as ProjectRole;
      if (!roles.includes(role)) throw new ProjectError("Invalid project role.");
      if (actor.role !== "SUPER_ADMIN" && actorRole !== "ADMIN" && role !== "PARTICIPANT") throw new ProjectError("Only project admins can assign elevated roles.");
      if (operation === "add") {
        if (member) throw new ProjectError("This user is already a project member.");
        if (!await tx.user.findFirst({ where: { id: userId, is_active: true } })) throw new ProjectError("Choose an active user.");
        return tx.projectMembership.create({ data: { project_id: projectId, user_id: userId, role } });
      }
      if (!member) throw new ProjectError("This user is no longer a member.");
      return tx.projectMembership.update({ where: { id: member.id }, data: { role } });
    }
    if (!member) throw new ProjectError("This user is no longer a member.");
    if (actor.role !== "SUPER_ADMIN" && actorRole !== "ADMIN" && member.role !== "PARTICIPANT") throw new ProjectError("Managers can only remove participants.");
    // A removed member must no longer be assigned tasks in this project.
    await tx.task.updateMany({ where: { project_id: projectId, assigned_to: userId }, data: { assigned_to: null } });
    return tx.projectMembership.delete({ where: { id: member.id } });
  }, { isolationLevel: "Serializable" });
}
