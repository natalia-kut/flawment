import {
  taskPriorities,
  taskStatuses,
  type TaskPriority,
  type TaskStatus,
} from "./types";

// A template is an ordered list of blocks. Text blocks may contain {{variables}};
// table blocks describe a query over the selected project's tasks or members.

export const variableOptions = [
  { key: "project", label: "Project name" },
  { key: "description", label: "Project description" },
  { key: "status", label: "Project status" },
  { key: "owner", label: "Project owner" },
  { key: "ownerEmail", label: "Owner email" },
  { key: "managers", label: "Managers" },
  { key: "memberCount", label: "Team size" },
  { key: "startDate", label: "Start date" },
  { key: "endDate", label: "End date" },
  { key: "duration", label: "Planned duration" },
  { key: "daysRemaining", label: "Time remaining" },
  { key: "timeElapsed", label: "Time elapsed" },
  { key: "progress", label: "Task completion" },
  { key: "scheduleHealth", label: "Schedule health" },
  { key: "totalTasks", label: "All tasks" },
  { key: "completedTasks", label: "Completed tasks" },
  { key: "openTasks", label: "Open tasks" },
  { key: "overdueTasks", label: "Overdue tasks" },
  { key: "dueSoon", label: "Due in 14 days" },
  { key: "inReview", label: "Awaiting review" },
  { key: "highPriorityOpen", label: "Open high/urgent" },
  { key: "unassignedTasks", label: "Unassigned open tasks" },
  { key: "cancelledTasks", label: "Cancelled tasks" },
  { key: "today", label: "Today's date" },
] as const;

export type VariableKey = (typeof variableOptions)[number]["key"];

export const taskColumnOptions = [
  { key: "title", label: "Task" },
  { key: "assignee", label: "Assigned to" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "deadline", label: "Deadline" },
  { key: "timing", label: "Timing" },
  { key: "creator", label: "Created by" },
  { key: "description", label: "Description" },
] as const;

export type TaskColumn = (typeof taskColumnOptions)[number]["key"];

export const memberColumnOptions = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "joined", label: "Joined" },
  { key: "open", label: "Open tasks" },
  { key: "completed", label: "Completed" },
  { key: "overdue", label: "Overdue" },
  { key: "highPriority", label: "High/urgent open" },
] as const;

export type MemberColumn = (typeof memberColumnOptions)[number]["key"];

export const dueFilterOptions = [
  { key: "any", label: "Any deadline" },
  { key: "overdue", label: "Overdue" },
  { key: "next14", label: "Due in the next 14 days" },
  { key: "noDeadline", label: "No deadline" },
] as const;

export const assignmentFilterOptions = [
  { key: "any", label: "Anyone" },
  { key: "assigned", label: "Assigned" },
  { key: "unassigned", label: "Unassigned" },
] as const;

export const taskSortOptions = [
  { key: "deadline", label: "Deadline" },
  { key: "priority", label: "Priority (highest first)" },
  { key: "status", label: "Status" },
  { key: "title", label: "Title" },
] as const;

export const memberSortOptions = [
  { key: "role", label: "Role" },
  { key: "name", label: "Name" },
  { key: "open", label: "Most open tasks" },
  { key: "overdue", label: "Most overdue" },
] as const;

export const chartKindOptions = [
  { key: "status", label: "Task status breakdown" },
  { key: "progressVsTime", label: "Progress vs. time elapsed" },
  { key: "timeline", label: "Deadline timeline" },
  { key: "workload", label: "Open work per person" },
  { key: "deadlineWeeks", label: "Deadlines per week" },
  { key: "priorityMatrix", label: "Priority × status matrix" },
] as const;

export const signerOptions = [
  { key: "owner", label: "Project owner" },
  { key: "ownerAndManagers", label: "Owner and managers" },
  { key: "allMembers", label: "All members" },
] as const;

type OptionKey<T extends readonly { key: string }[]> = T[number]["key"];

export type TaskFilter = {
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  due: OptionKey<typeof dueFilterOptions>;
  assignment: OptionKey<typeof assignmentFilterOptions>;
};

export type TaskSort = OptionKey<typeof taskSortOptions>;
export type MemberSort = OptionKey<typeof memberSortOptions>;
export type Signers = OptionKey<typeof signerOptions>;
export type ChartKind = OptionKey<typeof chartKindOptions>;

export type TemplateBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "facts"; title: string; facts: VariableKey[] }
  | { id: string; type: "metrics"; metrics: VariableKey[] }
  | { id: string; type: "chart"; kind: ChartKind; title: string }
  | {
      id: string;
      type: "taskTable";
      title: string;
      columns: TaskColumn[];
      filter: TaskFilter;
      sort: TaskSort;
      limit: number | null;
      emptyText: string;
    }
  | { id: string; type: "memberTable"; title: string; columns: MemberColumn[]; sort: MemberSort }
  | { id: string; type: "signatures"; title: string; signers: Signers }
  | { id: string; type: "pageBreak" };

export type BlockType = TemplateBlock["type"];

export const blockTypeOptions: { type: BlockType; label: string; hint: string }[] = [
  { type: "heading", label: "Heading", hint: "Section title" },
  { type: "text", label: "Text", hint: "Paragraphs with {{variables}}" },
  { type: "facts", label: "Fact sheet", hint: "Label / value table" },
  { type: "metrics", label: "Key figures", hint: "Highlighted numbers" },
  { type: "chart", label: "Chart", hint: "Timeline, workload, deadlines…" },
  { type: "taskTable", label: "Task table", hint: "Filtered list of tasks" },
  { type: "memberTable", label: "Team table", hint: "Members and workload" },
  { type: "signatures", label: "Signatures", hint: "Sign-off lines" },
  { type: "pageBreak", label: "Page break", hint: "Start a new PDF page" },
];

export type DocumentTemplate = {
  id: string;
  name: string;
  description: string;
  blocks: TemplateBlock[];
  isBuiltIn: boolean;
  projectId: number | null;
  showStatus: boolean;
  showName: boolean;
};

export type TemplateInput = {
  name: string;
  description: string;
  blocks: TemplateBlock[];
  showStatus: boolean;
  showName: boolean;
};

export const templateLimits = { name: 60, description: 160, text: 2000, title: 80, blocks: 40 };

export function newBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createBlock(type: BlockType): TemplateBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type, text: "New section" };
    case "text":
      return { id, type, text: "{{project}} is currently {{status}}." };
    case "facts":
      return { id, type, title: "Project details", facts: ["project", "owner", "startDate", "endDate"] };
    case "metrics":
      return { id, type, metrics: ["progress", "openTasks", "overdueTasks"] };
    case "chart":
      return { id, type, kind: "timeline", title: "Deadline timeline" };
    case "taskTable":
      return {
        id,
        type,
        title: "Tasks",
        columns: ["title", "assignee", "status", "deadline"],
        filter: { statuses: [], priorities: [], due: "any", assignment: "any" },
        sort: "deadline",
        limit: null,
        emptyText: "No tasks match this section.",
      };
    case "memberTable":
      return { id, type, title: "Team", columns: ["name", "role", "email"], sort: "role" };
    case "signatures":
      return { id, type, title: "Approval", signers: "ownerAndManagers" };
    case "pageBreak":
      return { id, type };
  }
}

// --- Validation -----------------------------------------------------------
// Templates come from the browser, so everything is checked before it is stored.

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keysOf(options: readonly { key: string }[]) {
  return options.map((option) => option.key);
}

function pick<T extends string>(value: unknown, allowed: readonly string[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value) ? (value as T) : fallback;
}

function pickList<T extends string>(value: unknown, allowed: readonly string[]): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T => typeof item === "string" && allowed.includes(item)))];
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function parseBlock(raw: unknown): TemplateBlock | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : newBlockId();
  const title = text(raw.title, templateLimits.title);

  switch (raw.type) {
    case "heading":
      return { id, type: "heading", text: text(raw.text, templateLimits.title) };
    case "text":
      return { id, type: "text", text: text(raw.text, templateLimits.text) };
    case "facts":
      return { id, type: "facts", title, facts: pickList(raw.facts, keysOf(variableOptions)) };
    case "metrics":
      return { id, type: "metrics", metrics: pickList<VariableKey>(raw.metrics, keysOf(variableOptions)).slice(0, 6) };
    case "chart":
      return { id, type: "chart", kind: pick(raw.kind, keysOf(chartKindOptions), "status"), title };
    // Templates saved before charts had kinds.
    case "statusChart":
      return { id, type: "chart", kind: "status", title };
    case "taskTable": {
      const filter = isRecord(raw.filter) ? raw.filter : {};
      const limit = typeof raw.limit === "number" && Number.isInteger(raw.limit) && raw.limit > 0 ? Math.min(raw.limit, 200) : null;
      return {
        id,
        type: "taskTable",
        title,
        columns: pickList(raw.columns, keysOf(taskColumnOptions)),
        filter: {
          statuses: pickList(filter.statuses, taskStatuses),
          priorities: pickList(filter.priorities, taskPriorities),
          due: pick(filter.due, keysOf(dueFilterOptions), "any"),
          assignment: pick(filter.assignment, keysOf(assignmentFilterOptions), "any"),
        },
        sort: pick(raw.sort, keysOf(taskSortOptions), "deadline"),
        limit,
        emptyText: text(raw.emptyText, templateLimits.title),
      };
    }
    case "memberTable":
      return {
        id,
        type: "memberTable",
        title,
        columns: pickList(raw.columns, keysOf(memberColumnOptions)),
        sort: pick(raw.sort, keysOf(memberSortOptions), "role"),
      };
    case "signatures":
      return { id, type: "signatures", title, signers: pick(raw.signers, keysOf(signerOptions), "owner") };
    case "pageBreak":
      return { id, type: "pageBreak" };
    default:
      return null;
  }
}

export function parseBlocks(raw: unknown): TemplateBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, templateLimits.blocks)
    .map(parseBlock)
    .filter((block): block is TemplateBlock => block !== null);
}

export function parseTemplateInput(raw: unknown): Result<TemplateInput> {
  if (!isRecord(raw)) return { ok: false, error: "Invalid template." };

  const name = text(raw.name, templateLimits.name).trim();
  if (!name) return { ok: false, error: "Give the template a name." };

  const blocks = parseBlocks(raw.blocks);
  if (blocks.length === 0) return { ok: false, error: "Add at least one block." };

  const tableWithoutColumns = blocks.find(
    (block) => (block.type === "taskTable" || block.type === "memberTable") && block.columns.length === 0,
  );
  if (tableWithoutColumns) return { ok: false, error: "Every table needs at least one column." };

  return {
    ok: true,
    value: {
      name,
      description: text(raw.description, templateLimits.description).trim(),
      blocks,
      showStatus: raw.showStatus !== false,
      showName: raw.showName !== false,
    },
  };
}
