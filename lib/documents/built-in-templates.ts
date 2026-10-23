import type { DocumentTemplate, TaskFilter } from "./template-schema";

const openStatuses: TaskFilter["statuses"] = ["TO_DO", "IN_PROGRESS", "IN_REVIEW"];

function filter(overrides: Partial<TaskFilter>): TaskFilter {
  return { statuses: [], priorities: [], due: "any", assignment: "any", ...overrides };
}

export const builtInTemplates: DocumentTemplate[] = [
  {
    id: "builtin-status-report",
    name: "Status report",
    description: "Progress against the schedule, what is late and what is coming up next.",
    isBuiltIn: true,
    blocks: [
      {
        id: "intro",
        type: "text",
        text:
          "Status of {{project}} as of {{today}} — schedule health: {{scheduleHealth}}. " +
          "{{progress}} of tasks are completed while {{timeElapsed}} of the planned time has passed " +
          "({{daysRemaining}} remaining until {{endDate}}).",
      },
      { id: "kpi", type: "metrics", metrics: ["progress", "timeElapsed", "overdueTasks", "dueSoon"] },
      { id: "chart", type: "statusChart", title: "Task status" },
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
      {
        id: "review",
        type: "taskTable",
        title: "Awaiting review",
        columns: ["title", "assignee", "deadline"],
        filter: filter({ statuses: ["IN_REVIEW"] }),
        sort: "deadline",
        limit: null,
        emptyText: "No tasks are waiting for review.",
      },
    ],
  },
  {
    id: "builtin-team-workload",
    name: "Team workload",
    description: "How open work is spread across the team, plus tasks nobody owns yet.",
    isBuiltIn: true,
    blocks: [
      {
        id: "intro",
        type: "text",
        text:
          "Workload overview for {{project}} ({{memberCount}}), prepared on {{today}}. " +
          "There are {{openTasks}} open tasks, {{highPriorityOpen}} of them high or urgent priority, " +
          "and {{unassignedTasks}} still without an owner.",
      },
      { id: "kpi", type: "metrics", metrics: ["openTasks", "highPriorityOpen", "overdueTasks", "unassignedTasks"] },
      {
        id: "team",
        type: "memberTable",
        title: "Open work per person",
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
    description: "High-priority, late and unplanned work that needs a decision.",
    isBuiltIn: true,
    blocks: [
      {
        id: "intro",
        type: "text",
        text:
          "This report lists work on {{project}} that puts the {{endDate}} deadline at risk. " +
          "Current assessment: {{scheduleHealth}}. Please review each item with {{owner}} " +
          "and agree on an owner and a recovery date.",
      },
      { id: "kpi", type: "metrics", metrics: ["scheduleHealth", "overdueTasks", "highPriorityOpen", "daysRemaining"] },
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
      {
        id: "unplanned",
        type: "taskTable",
        title: "Open tasks without a deadline",
        columns: ["title", "assignee", "priority"],
        filter: filter({ statuses: openStatuses, due: "noDeadline" }),
        sort: "priority",
        limit: null,
        emptyText: "Every open task is scheduled.",
      },
      { id: "sign", type: "signatures", title: "Reviewed by", signers: "ownerAndManagers" },
    ],
  },
  {
    id: "builtin-handover-protocol",
    name: "Handover protocol",
    description: "Formal acceptance record: delivered scope, open items and sign-off.",
    isBuiltIn: true,
    blocks: [
      { id: "heading", type: "heading", text: "Acceptance protocol — {{project}}" },
      {
        id: "facts",
        type: "facts",
        title: "Project details",
        facts: ["project", "owner", "managers", "status", "startDate", "endDate", "duration", "memberCount"],
      },
      {
        id: "intro",
        type: "text",
        text:
          "On {{today}} the parties confirm the handover of {{project}}. " +
          "{{completedTasks}} of {{totalTasks}} tasks were delivered ({{progress}} of the planned scope); " +
          "Tasks cancelled by agreement: {{cancelledTasks}}.",
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
