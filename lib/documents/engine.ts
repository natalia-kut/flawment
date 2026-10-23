import type { MemberSort, TaskFilter, TaskSort, VariableKey } from "./template-schema";
import {
  projectRoleLabels,
  projectStatusLabels,
  taskPriorities,
  taskStatuses,
  type DocumentMember,
  type DocumentProject,
  type DocumentTask,
  type TaskStatus,
} from "./types";

// Pure calculations shared by the preview and the template builder.

const dayMs = 24 * 60 * 60 * 1000;

function toUtc(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

export function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / dayMs);
}

function addDays(day: string, days: number) {
  return new Date(toUtc(day) + days * dayMs).toISOString().slice(0, 10);
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(day: string | null) {
  return day ? dateFormatter.format(toUtc(day)) : "—";
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function isOpen(task: DocumentTask) {
  return task.status !== "COMPLETED" && task.status !== "CANCELLED";
}

export function isOverdue(task: DocumentTask, today: string) {
  return isOpen(task) && task.deadline !== null && task.deadline < today;
}

function isDueSoon(task: DocumentTask, today: string) {
  return isOpen(task) && task.deadline !== null && task.deadline >= today && task.deadline <= addDays(today, 14);
}

function isHighPriority(task: DocumentTask) {
  return task.priority === "HIGH" || task.priority === "URGENT";
}

export function describeTiming(task: DocumentTask, today: string) {
  if (task.status === "COMPLETED") return "Done";
  if (task.status === "CANCELLED") return "Cancelled";
  if (!task.deadline) return "No deadline";

  const days = daysBetween(today, task.deadline);
  if (days < 0) return `${plural(-days, "day")} late`;
  if (days === 0) return "Due today";
  return `Due in ${plural(days, "day")}`;
}

export function countByStatus(project: DocumentProject) {
  const counts = Object.fromEntries(taskStatuses.map((status) => [status, 0])) as Record<TaskStatus, number>;
  for (const task of project.tasks) counts[task.status] += 1;
  return counts;
}

function scheduleHealth(project: DocumentProject, today: string, progress: number, elapsed: number | null, overdue: number) {
  if (project.status !== "IN_PROGRESS" && project.status !== "TO_DO") return projectStatusLabels[project.status];
  if (today < project.startDate) return "Not started";

  const openTasks = project.tasks.filter(isOpen).length;
  if (project.endDate && today > project.endDate && openTasks > 0) return "Past deadline";
  if (overdue > 0 || (elapsed !== null && progress < elapsed - 15)) return "At risk";
  return "On track";
}

export function buildVariables(project: DocumentProject, today: string): Record<VariableKey, string> {
  const tasks = project.tasks;
  const open = tasks.filter(isOpen);
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const cancelled = tasks.filter((task) => task.status === "CANCELLED").length;
  const overdue = tasks.filter((task) => isOverdue(task, today)).length;
  const counted = tasks.length - cancelled;
  const progress = counted > 0 ? Math.round((completed / counted) * 100) : 0;

  let elapsed: number | null = null;
  let duration = "No end date";
  let remaining = "No end date";
  if (project.endDate) {
    const total = Math.max(daysBetween(project.startDate, project.endDate), 1);
    const passed = daysBetween(project.startDate, today);
    elapsed = Math.round(Math.min(Math.max(passed / total, 0), 1) * 100);
    duration = plural(total, "day");

    const left = daysBetween(today, project.endDate);
    remaining = left > 0 ? plural(left, "day") : left === 0 ? "Ends today" : `Ended ${plural(-left, "day")} ago`;
  }

  const managers = project.members.filter((member) => member.role === "MANAGER").map((member) => member.person.name);

  return {
    project: project.name,
    description: project.description ?? "",
    status: projectStatusLabels[project.status],
    owner: project.owner.name,
    ownerEmail: project.owner.email,
    managers: managers.length > 0 ? managers.join(", ") : "—",
    memberCount: plural(project.members.length, "member"),
    startDate: formatDay(project.startDate),
    endDate: formatDay(project.endDate),
    duration,
    daysRemaining: remaining,
    timeElapsed: elapsed === null ? "—" : `${elapsed}%`,
    progress: `${progress}%`,
    scheduleHealth: scheduleHealth(project, today, progress, elapsed, overdue),
    totalTasks: String(tasks.length),
    completedTasks: String(completed),
    openTasks: String(open.length),
    overdueTasks: String(overdue),
    dueSoon: String(tasks.filter((task) => isDueSoon(task, today)).length),
    inReview: String(tasks.filter((task) => task.status === "IN_REVIEW").length),
    highPriorityOpen: String(open.filter(isHighPriority).length),
    unassignedTasks: String(open.filter((task) => !task.assignee).length),
    cancelledTasks: String(cancelled),
    today: formatDay(today),
  };
}

export function interpolate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.hasOwn(variables, key) ? variables[key] : match,
  );
}

export function selectTasks(
  project: DocumentProject,
  today: string,
  filter: TaskFilter,
  sort: TaskSort,
  limit: number | null,
) {
  const rows = project.tasks.filter((task) => {
    if (filter.statuses.length > 0 && !filter.statuses.includes(task.status)) return false;
    if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false;
    if (filter.assignment === "assigned" && !task.assignee) return false;
    if (filter.assignment === "unassigned" && task.assignee) return false;
    if (filter.due === "overdue") return isOverdue(task, today);
    if (filter.due === "next14") return isDueSoon(task, today);
    if (filter.due === "noDeadline") return task.deadline === null;
    return true;
  });

  const byDeadline = (a: DocumentTask, b: DocumentTask) =>
    (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31");
  const comparators: Record<TaskSort, (a: DocumentTask, b: DocumentTask) => number> = {
    deadline: byDeadline,
    priority: (a, b) =>
      taskPriorities.indexOf(b.priority) - taskPriorities.indexOf(a.priority) || byDeadline(a, b),
    status: (a, b) => taskStatuses.indexOf(a.status) - taskStatuses.indexOf(b.status) || byDeadline(a, b),
    title: (a, b) => a.title.localeCompare(b.title),
  };

  rows.sort(comparators[sort]);
  return limit ? rows.slice(0, limit) : rows;
}

export type MemberRow = DocumentMember & {
  open: number;
  completed: number;
  overdue: number;
  highPriority: number;
};

const roleOrder = ["ADMIN", "MANAGER", "PARTICIPANT"] as const;

export function selectMembers(project: DocumentProject, today: string, sort: MemberSort): MemberRow[] {
  const rows = project.members.map((member) => {
    const tasks = project.tasks.filter((task) => task.assignee?.id === member.person.id);
    const open = tasks.filter(isOpen);
    return {
      ...member,
      open: open.length,
      completed: tasks.filter((task) => task.status === "COMPLETED").length,
      overdue: tasks.filter((task) => isOverdue(task, today)).length,
      highPriority: open.filter(isHighPriority).length,
    };
  });

  const byName = (a: MemberRow, b: MemberRow) => a.person.name.localeCompare(b.person.name);
  const comparators: Record<MemberSort, (a: MemberRow, b: MemberRow) => number> = {
    name: byName,
    role: (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || byName(a, b),
    open: (a, b) => b.open - a.open || byName(a, b),
    overdue: (a, b) => b.overdue - a.overdue || b.open - a.open || byName(a, b),
  };
  return rows.sort(comparators[sort]);
}

export function roleLabel(project: DocumentProject, member: DocumentMember) {
  return member.person.id === project.owner.id ? "Project owner" : projectRoleLabels[member.role];
}
