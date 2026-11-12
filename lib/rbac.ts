import type { ProjectRole, UserRole } from "@/src/generated/prisma/enums";

/**
 * What each project role may do. A super admin may do everything everywhere.
 * "tasks:own" covers the tasks you created or that are assigned to you.
 */
export const permissions = {
  OWNER: ["project:read", "project:update", "project:delete", "members:manage", "members:roles", "tasks:manage", "tasks:create", "tasks:own"],
  COORDINATOR: ["project:read", "project:update", "members:manage", "tasks:manage", "tasks:create", "tasks:own"],
  CONTRIBUTOR: ["project:read", "tasks:create", "tasks:own"],
} as const;
export type Permission = (typeof permissions)["OWNER"][number];
export type Actor = { id: number; role: UserRole };

export function can(role: ProjectRole | null, permission: Permission, userRole: UserRole = "USER") {
  return userRole === "SUPER_ADMIN" || (role !== null && (permissions[role] as readonly string[]).includes(permission));
}

export function visibleProjects(user: Actor) {
  return user.role === "SUPER_ADMIN" ? {} : { memberships: { some: { user_id: user.id } } };
}
