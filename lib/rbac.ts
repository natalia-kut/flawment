import type { ProjectRole, UserRole } from "@/src/generated/prisma/enums";

export const permissions = {
  ADMIN: ["project:read", "project:update", "project:delete", "members:manage", "members:roles", "tasks:manage", "tasks:update-assigned"],
  MANAGER: ["project:read", "project:update", "members:manage", "tasks:manage", "tasks:update-assigned"],
  PARTICIPANT: ["project:read", "tasks:update-assigned"],
} as const;
export type Permission = (typeof permissions)["ADMIN"][number];
export type Actor = { id: number; role: UserRole };

export function can(role: ProjectRole | null, permission: Permission, userRole: UserRole = "USER") {
  return userRole === "SUPER_ADMIN" || (role !== null && (permissions[role] as readonly string[]).includes(permission));
}

export function visibleProjects(user: Actor) {
  return user.role === "SUPER_ADMIN" ? {} : { memberships: { some: { user_id: user.id } } };
}
