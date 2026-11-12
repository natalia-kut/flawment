/** How each project status is named in the interface. */
export const projectStatusLabels: Record<string, string> = {
  TO_DO: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

/** Project roles in plain words; a participant is the default and needs no badge. */
export const projectRoleLabels: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  PARTICIPANT: "Participant",
};
