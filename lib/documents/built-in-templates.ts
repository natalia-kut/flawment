import type { DocumentTemplate, TaskFilter } from "./template-schema";

const openStatuses: TaskFilter["statuses"] = ["TO_DO", "IN_PROGRESS", "IN_REVIEW"];

export const builtIn = { isBuiltIn: true, projectId: null, showStatus: true, showName: true } as const;

function filter(overrides: Partial<TaskFilter>): TaskFilter {
  return { statuses: [], priorities: [], due: "any", assignment: "any", ...overrides };
}

export const builtInTemplates: DocumentTemplate[] = [
  {
    id: "builtin-status-report",
    name: "Weekly update",
    description: "What happened this week, what needs attention and why, and where the pace leads.",
    ...builtIn,
    blocks: [
      { id: "kpi", type: "metrics", metrics: ["progress", "completedWeek", "overdueTasks", "daysRemaining"] },
      { id: "attention", type: "insights", title: "What needs attention" },
      { id: "week", type: "activity", title: "What happened this week", days: 7 },
      { id: "pace", type: "chart", kind: "pace", title: "Pace and forecast" },
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
    id: "builtin-roadmap",
    name: "Project roadmap",
    description: "The project stage by stage: what is done, what is next and when.",
    ...builtIn,
    blocks: [
      { id: "stages", type: "chart", kind: "stageRoadmap", title: "Stages" },
      { id: "attention", type: "insights", title: "What needs attention" },
      {
        id: "work",
        type: "taskTable",
        title: "Open work by stage",
        columns: ["title", "stage", "assignee", "status", "deadline"],
        filter: filter({ statuses: openStatuses }),
        sort: "stage",
        limit: null,
        emptyText: "No open work.",
      },
    ],
  },
  {
    id: "builtin-team-workload",
    name: "Team plan",
    description: "Who has what due in the next two weeks, when they are away, and work nobody owns yet.",
    ...builtIn,
    blocks: [
      { id: "plan", type: "chart", kind: "teamPlan", title: "The next two weeks" },
      {
        id: "team",
        type: "memberTable",
        title: "All their work",
        columns: ["name", "role", "open", "highPriority", "completed"],
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
    id: "builtin-handover-protocol",
    name: "Handover protocol",
    description: "Formal acceptance record: delivered scope, open items, files and sign-off.",
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
        columns: ["title", "stage", "assignee", "completed"],
        filter: filter({ statuses: ["COMPLETED"] }),
        sort: "stage",
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
      { id: "files", type: "fileTable", title: "Files handed over" },
      { id: "team", type: "memberTable", title: "Project team", columns: ["name", "role", "email", "joined"], sort: "role" },
      { id: "sign", type: "signatures", title: "Signatures", signers: "ownerAndManagers" },
    ],
  },
];
