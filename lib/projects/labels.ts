import type { ProjectRole } from "@/src/generated/prisma/enums";

/** How each project status is named in the interface. */
export const projectStatusLabels: Record<string, string> = {
  TO_DO: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

/** Project roles in plain words; a contributor is the default and needs no badge. */
export const projectRoleLabels: Record<ProjectRole, string> = {
  OWNER: "Owner",
  COORDINATOR: "Coordinator",
  CONTRIBUTOR: "Contributor",
};
