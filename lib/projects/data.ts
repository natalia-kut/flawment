import { requireUser } from "@/lib/auth/session";
import { can, visibleProjects } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { findAvailableMembers } from "./service";

const person = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
} as const;

export async function getWorkspaceProjects() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: visibleProjects(user),
    orderBy: { created_at: "desc" },
    include: {
      stages: { orderBy: [{ created_at: "asc" }, { id: "asc" }] },
      memberships: {
        where:
          user.role === "SUPER_ADMIN"
            ? {}
            : { user: { role: "USER" } },
        include: { user: { select: person } },
        orderBy: { joined_at: "asc" },
      },
      tasks: {
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          deadline: true,
          assigned_to: true,
          stage_id: true,
          stage: { select: { name: true } },
          assignee: {
            select: {
              first_name: true,
              last_name: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return Promise.all(
    projects.map(async (project) => {
      const role =
        project.memberships.find((m) => m.user_id === user.id)?.role ??
        null;
      const manage = can(role, "members:manage", user.role);
      const eligible = manage
        ? await findAvailableMembers(project.id)
        : [];

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        start_date: project.start_date.toISOString().slice(0, 10),
        end_date: project.end_date?.toISOString().slice(0, 10) ?? "",
        owner_id: project.owner_id,
        role: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : role,
        canEdit: can(role, "project:update", user.role),
        canDelete: can(role, "project:delete", user.role),
        canManage: manage,
        canManageTasks: can(role, "tasks:manage", user.role),
        canAssignRoles: can(role, "members:roles", user.role),
        members: project.memberships.map((m) => ({
          ...m.user,
          role: m.role,
        })),
        eligible,
        stages: project.stages.map((stage) => ({
          id: stage.id, name: stage.name, description: stage.description,
          deadline: stage.deadline?.toISOString().slice(0, 10) ?? "",
          taskCount: project.tasks.filter((task) => task.stage_id === stage.id).length,
          doneCount: project.tasks.filter((task) => task.stage_id === stage.id && task.status === "COMPLETED").length,
        })),
        tasks: project.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          canChangeStatus: can(role, "tasks:manage", user.role) || (task.assigned_to === user.id && can(role, "tasks:update-assigned", user.role)),
          description: task.description,
          status: task.status,
          priority: task.priority,
          stageId: task.stage_id,
          stageName: task.stage?.name ?? "No stage",
          assignedTo: task.assignee?.role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN" ? null : task.assigned_to,
          deadline: task.deadline?.toISOString().slice(0, 10) ?? "",
          assigneeName: task.assignee
            ? task.assignee.role === "SUPER_ADMIN" &&
              user.role !== "SUPER_ADMIN"
              ? "Administrator"
              : `${task.assignee.first_name} ${task.assignee.last_name}`
            : "Unassigned",
        })),
      };
    }),
  );
}

export type WorkspaceProject =
  Awaited<ReturnType<typeof getWorkspaceProjects>>[number];
