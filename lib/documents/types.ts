import type {
  ProjectRole,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@/src/generated/prisma/enums";

export type { ProjectRole, ProjectStatus, TaskPriority, TaskStatus };

// Plain, serializable project data passed from the server to the documents page.
// Dates are ISO day strings (YYYY-MM-DD) so they render identically everywhere.
export type DocumentPerson = {
  id: number;
  name: string;
  email: string;
  username: string;
};

export type DocumentTask = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  assignee: DocumentPerson | null;
  creator: DocumentPerson;
};

export type DocumentMember = {
  person: DocumentPerson;
  role: ProjectRole;
  joinedAt: string;
};

export type DocumentProject = {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string;
  endDate: string | null;
  owner: DocumentPerson;
  members: DocumentMember[];
  tasks: DocumentTask[];
};

export const taskStatuses = ["TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"] as const satisfies readonly TaskStatus[];
export const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const satisfies readonly TaskPriority[];

export const taskStatusLabels: Record<TaskStatus, string> = {
  TO_DO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  TO_DO: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

export const projectRoleLabels: Record<ProjectRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  PARTICIPANT: "Participant",
};
