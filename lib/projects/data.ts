import { requireUser } from "@/lib/auth/session";
import { can, visibleProjects } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { findAvailableMembers } from "./service";

const person = { id: true, first_name: true, last_name: true, email: true } as const;
export async function getWorkspaceProjects() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({ where: visibleProjects(user), orderBy: { created_at: "desc" },
    include: { memberships: { where: user.role === "SUPER_ADMIN" ? {} : { user: { role: "USER" } }, include: { user: { select: person } }, orderBy: { joined_at: "asc" } } } });
  return Promise.all(projects.map(async (project) => {
    const role = project.memberships.find((m) => m.user_id === user.id)?.role ?? null;
    const manage = can(role, "members:manage", user.role);
    const eligible = manage ? await findAvailableMembers(project.id) : [];
    return {
      id: project.id, name: project.name, description: project.description, status: project.status,
      start_date: project.start_date.toISOString().slice(0, 10), end_date: project.end_date?.toISOString().slice(0, 10) ?? "",
      owner_id: project.owner_id, role: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : role,
      canEdit: can(role, "project:update", user.role), canDelete: can(role, "project:delete", user.role),
      canManage: manage, canAssignRoles: can(role, "members:roles", user.role),
      members: project.memberships.map((m) => ({ ...m.user, role: m.role })), eligible,
    };
  }));
}
export type WorkspaceProject = Awaited<ReturnType<typeof getWorkspaceProjects>>[number];
