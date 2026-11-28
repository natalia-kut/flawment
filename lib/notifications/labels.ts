import { taskStatusLabels } from "@/lib/tasks/labels";
import type { NotificationType, RequestStatus, TaskStatus } from "@/src/generated/prisma/enums";

/** A notification as the bell shows it: plain data, safe to send to the browser. */
export type NotificationItem = {
  id: number;
  type: NotificationType;
  actor: string | null;
  task: { id: number; title: string } | null;
  project: { id: number; name: string } | null;
  request: { person: string; title: string; status: RequestStatus } | null;
  status: TaskStatus | null;
  createdAt: string;
  read: boolean;
};

/** The sentence for a notification, in parts, so the names can be set in bold. */
export function notificationText(item: NotificationItem): { who: string; text: string; what: string } {
  const who = item.actor ?? "Someone";
  const task = item.task?.title ?? "a task";
  switch (item.type) {
    case "TASK_ASSIGNED": return { who, text: "assigned you", what: task };
    case "TASK_STATUS": return { who, text: `moved to ${item.status ? taskStatusLabels[item.status] : "another status"}:`, what: task };
    case "TASK_COMMENT": return { who, text: "commented on", what: task };
    case "PROJECT_ADDED": return { who, text: "added you to", what: item.project?.name ?? "a project" };
    case "TITLE_REQUEST": return { who, text: `suggests a new job title for ${item.request?.person ?? "a team member"}:`, what: item.request?.title ?? "" };
    case "TITLE_DECIDED": return {
      who, text: `${item.request?.status === "DECLINED" ? "declined" : "approved"} your suggestion for ${item.request?.person ?? "a team member"}:`,
      what: item.request?.title ?? "",
    };
  }
}

/** Where a notification leads: the task, the project, or where the request is dealt with. */
export function notificationHref(item: NotificationItem) {
  if (item.task) return `/?task=${item.task.id}`;
  if (item.project) return `/?project=${item.project.id}`;
  // Administrators decide requests on the dashboard; leads follow theirs on the Team page.
  return item.type === "TITLE_REQUEST" ? "/" : "/?view=team";
}
