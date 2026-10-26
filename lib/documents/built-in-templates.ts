import type { DocumentTemplate, TaskFilter } from "./template-schema";

const openStatuses: TaskFilter["statuses"] = ["TO_DO", "IN_PROGRESS", "IN_REVIEW"];

export const builtIn = { isBuiltIn: true, projectId: null, showStatus: true, showName: true } as const;

function filter(overrides: Partial<TaskFilter>): TaskFilter {
  return { statuses: [], priorities: [], due: "any", assignment: "any", ...overrides };
}

export const builtInTemplates: DocumentTemplate[] = [
  {
    id: "builtin-status-report",
    name: "Status report",
    description: "Progress against the schedule, what is late and what is coming up next.",
    ...builtIn,
    blocks: [
      { id: "kpi", type: "metrics", metrics: ["scheduleHealth", "progress", "overdueTasks", "dueSoon"] },
      { id: "pace", type: "chart", kind: "progressVsTime", title: "Progress against the schedule" },
      { id: "chart", type: "chart", kind: "status", title: "Task status" },
      {
        id: "overdue",
        type: "taskTable",
        title: "Overdue",
        columns: ["title", "assignee", "priority", "deadline", "timing"],
        filter: filter({ due: "overdue" }),
        sort: "deadline",
        limit: null,
        emptyText: "Nothing is overdue.",
      },
      {
        id: "upcoming",
        type: "taskTable",
        title: "Due in the next 14 days",
        columns: ["title", "assignee", "status", "deadline", "timing"],
        filter: filter({ due: "next14" }),
        sort: "deadline",
        limit: null,
        emptyText: "No deadlines in the next two weeks.",
      },
    ],
  },
  {
    id: "builtin-team-workload",
    name: "Team workload",
    description: "How open work is spread across the team, plus tasks nobody owns yet.",
    ...builtIn,
    blocks: [
      { id: "kpi", type: "metrics", metrics: ["openTasks", "highPriorityOpen", "overdueTasks", "unassignedTasks"] },
      { id: "load", type: "chart", kind: "workload", title: "Open work per person" },
      {
        id: "team",
        type: "memberTable",
        title: "Workload details",
        columns: ["name", "role", "open", "highPriority", "overdue", "completed"],
        sort: "open",
      },
      {
        id: "unassigned",
        type: "taskTable",
        title: "Unassigned tasks",
        columns: ["title", "priority", "deadline", "timing"],
        filter: filter({ statuses: openStatuses, assignment: "unassigned" }),
        sort: "priority",
        limit: null,
        emptyText: "Every open task has an owner.",
      },
    ],
  },
  {
    id: "builtin-risk-register",
    name: "Risk & escalation report",
    description: "High-priority and late work that needs a decision.",
    ...builtIn,
    blocks: [
      { id: "kpi", type: "metrics", metrics: ["scheduleHealth", "overdueTasks", "highPriorityOpen", "daysRemaining"] },
      { id: "matrix", type: "chart", kind: "priorityMatrix", title: "Where the risk sits" },
      {
        id: "critical",
        type: "taskTable",
        title: "High and urgent open tasks",
        columns: ["title", "assignee", "priority", "status", "timing"],
        filter: filter({ statuses: openStatuses, priorities: ["HIGH", "URGENT"] }),
        sort: "deadline",
        limit: null,
        emptyText: "No open high-priority work.",
      },
      {
        id: "late",
        type: "taskTable",
        title: "Missed deadlines",
        columns: ["title", "assignee", "deadline", "timing"],
        filter: filter({ due: "overdue" }),
        sort: "deadline",
        limit: null,
        emptyText: "No missed deadlines.",
      },
      { id: "sign", type: "signatures", title: "Reviewed by", signers: "ownerAndManagers" },
    ],
  },
  {
    id: "builtin-handover-protocol",
    name: "Handover protocol",
    description: "Formal acceptance record: delivered scope, open items and sign-off.",
    ...builtIn,
    blocks: [
      { id: "heading", type: "heading", text: "Acceptance protocol — {{project}}" },
      {
        id: "facts",
        type: "facts",
        title: "Project details",
        facts: ["project", "owner", "managers", "status", "startDate", "endDate", "duration", "memberCount"],
      },
      {
        id: "delivered",
        type: "taskTable",
        title: "Delivered scope",
        columns: ["title", "assignee", "deadline"],
        filter: filter({ statuses: ["COMPLETED"] }),
        sort: "deadline",
        limit: null,
        emptyText: "No tasks have been completed yet.",
      },
      {
        id: "outstanding",
        type: "taskTable",
        title: "Outstanding and cancelled items",
        columns: ["title", "assignee", "status", "timing"],
        filter: filter({ statuses: ["TO_DO", "IN_PROGRESS", "IN_REVIEW", "CANCELLED"] }),
        sort: "status",
        limit: null,
        emptyText: "No outstanding items — full scope delivered.",
      },
      { id: "team", type: "memberTable", title: "Project team", columns: ["name", "role", "email", "joined"], sort: "role" },
      { id: "sign", type: "signatures", title: "Signatures", signers: "ownerAndManagers" },
    ],
  },
];
