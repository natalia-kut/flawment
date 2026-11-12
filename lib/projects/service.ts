import { prisma } from "@/lib/prisma";
import { can, type Actor, type Permission } from "@/lib/rbac";
import { absenceSelect, availability, canSeeAbsenceReason, toRanges } from "@/lib/time-off/availability";
import type { Viewer } from "@/lib/teams/data";
import { workspaceToday } from "@/lib/time-off/dates";
import type { Prisma, ProjectRole, ProjectStatus } from "@/src/generated/prisma/client";

export class ProjectError extends Error {}
/** The roles you can give someone; there is one owner, the person who created the project. */
const assignableRoles: ProjectRole[] = ["COORDINATOR", "CONTRIBUTOR"];
const statuses: ProjectStatus[] = ["TO_DO", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"];
const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function findAvailableMembers(projectId: number, today = workspaceToday(), viewer?: Viewer) {
  const users = await prisma.user.findMany({
    where: { is_active: true, role: "USER", memberships: { none: { project_id: projectId } } },
    select: { id: true, first_name: true, last_name: true, email: true, team_id: true, absences: absenceSelect(today) },
    orderBy: { first_name: "asc" },
  });
  // Whoever picks people sees who is away; only their team lead (or a super admin) sees why.
  return users.map(({ absences, team_id, ...user }) => ({
    ...user, availability: availability(toRanges(absences, !!viewer && canSeeAbsenceReason(viewer, { id: user.id, team_id })), today),
  }));
}
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
      // Projects are started by managers (a managerial job title) or a super admin.
      if (actor.role !== "SUPER_ADMIN") {
        const user = await tx.user.findUnique({ where: { id: actor.id }, select: { job_title: { select: { can_lead: true } } } });
        if (!user?.job_title?.can_lead) throw new ProjectError("Only managers can start a project.");
      }
      return tx.project.create({ data: { ...projectInput(data), owner_id: actor.id, memberships: { create: { user_id: actor.id, role: "OWNER" } } } });
    }
    const projectId = id(field(data, "project_id"));
    const permission = operation === "delete" ? "project:delete" : operation === "update" ? "project:update" : operation === "role" ? "members:roles" : "members:manage";
    const { project, role: actorRole } = await authorize(tx, actor, projectId, permission);
    if (operation === "delete") return tx.project.delete({ where: { id: projectId } });
    if (operation === "update") return tx.project.update({ where: { id: projectId }, data: projectInput(data) });
    if (!["add", "remove", "role"].includes(operation)) throw new ProjectError("Unknown project operation.");
    const userId = id(field(data, "user_id"));
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true } });
    if (!target || target.role === "SUPER_ADMIN") throw new ProjectError("Choose an available standard user.");
    if (userId === project.owner_id) throw new ProjectError("The project owner keeps their role.");
    const member = project.memberships.find((m) => m.user_id === userId);
    if (operation === "add" || operation === "role") {
      const role = field(data, "role") as ProjectRole;
      if (!assignableRoles.includes(role)) throw new ProjectError("Invalid project role.");
      if (role === "COORDINATOR" && !can(actorRole, "members:roles", actor.role)) throw new ProjectError("Only the project owner can name coordinators.");
      if (operation === "add") {
        if (member) throw new ProjectError("This user is already a project member.");
        if (!target.is_active) throw new ProjectError("Choose an active user.");
        return tx.projectMembership.create({ data: { project_id: projectId, user_id: userId, role } });
      }
      if (!member) throw new ProjectError("This user is no longer a member.");
      return tx.projectMembership.update({ where: { id: member.id }, data: { role } });
    }
    if (!member) throw new ProjectError("This user is no longer a member.");
    if (member.role !== "CONTRIBUTOR" && !can(actorRole, "members:roles", actor.role)) throw new ProjectError("Coordinators can only remove contributors.");
    // A removed member must no longer be assigned tasks in this project.
    await tx.task.updateMany({ where: { project_id: projectId, assigned_to: userId }, data: { assigned_to: null } });
    return tx.projectMembership.delete({ where: { id: member.id } });
  }, { isolationLevel: "Serializable" });
}
