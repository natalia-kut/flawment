import { z } from "zod";
import { saveTemplate } from "@/lib/documents/actions";
import { builtInTemplates } from "@/lib/documents/built-in-templates";
import { getDocumentProjects, getDocumentTemplates } from "@/lib/documents/data";
import { buildVariables, formatDay, interpolate, localDay, selectMembers, selectTasks } from "@/lib/documents/engine";
import {
  assignmentFilterOptions,
  blockTypeOptions,
  chartKindOptions,
  dueFilterOptions,
  memberColumnOptions,
  memberSortOptions,
  parseBlocks,
  signerOptions,
  taskColumnOptions,
  taskSortOptions,
  templateLimits,
  variableOptions,
  type TemplateBlock,
} from "@/lib/documents/template-schema";
import {
  projectRoleLabels,
  projectStatusLabels,
  taskPriorities,
  taskPriorityLabels,
  taskStatuses,
  taskStatusLabels,
  type DocumentProject,
} from "@/lib/documents/types";

// Flawiusz's tools for the in-app chat (lib/flawiusz/agent.ts). Tools only read
// project data and save templates through the same validation as the template builder.
// TODO(auth): Limit tools to the projects the signed-in user can see.

export type ToolResult = { ok: true; value: unknown } | { ok: false; error: string };

type ToolDefinition<Input extends z.ZodObject> = {
  name: string;
  title: string;
  description: string;
  // Shown in the chat while the tool runs.
  status: string;
  readOnly: boolean;
  input: Input;
  run: (args: z.infer<Input>) => Promise<ToolResult>;
};

export type FlawiuszTool = ToolDefinition<z.ZodObject>;

function defineTool<Input extends z.ZodObject>(tool: ToolDefinition<Input>) {
  return tool as unknown as FlawiuszTool;
}

function keys<T extends readonly { key: string }[]>(options: T) {
  return options.map((option) => option.key) as [T[number]["key"], ...T[number]["key"][]];
}

function labelOf(options: readonly { key: string; label: string }[], key: string) {
  return options.find((option) => option.key === key)?.label ?? key;
}

async function findProject(projectId: number) {
  const projects = await getDocumentProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

// --- Input schemas ---------------------------------------------------------
// A precise shape for the model to fill in; save_template still runs the
// app's own parseTemplateInput before anything is stored.

const variable = z.enum(keys(variableOptions));
const blockId = z.string().regex(/^[\w-]{1,40}$/).optional().describe("Optional; generated when omitted.");
const title = z.string().max(templateLimits.title);

const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockId, type: z.literal("heading"), text: title.describe("May contain {{variables}}.") }),
  z.object({
    id: blockId,
    type: z.literal("text"),
    text: z.string().max(templateLimits.text).describe("Paragraphs; may contain {{variables}}."),
  }),
  z.object({ id: blockId, type: z.literal("facts"), title, facts: z.array(variable).min(1) }),
  z.object({ id: blockId, type: z.literal("metrics"), metrics: z.array(variable).min(1).max(6) }),
  z.object({ id: blockId, type: z.literal("chart"), kind: z.enum(keys(chartKindOptions)), title }),
  z.object({
    id: blockId,
    type: z.literal("taskTable"),
    title,
    columns: z.array(z.enum(keys(taskColumnOptions))).min(1),
    filter: z.object({
      statuses: z.array(z.enum(taskStatuses)).describe("Empty means every status."),
      priorities: z.array(z.enum(taskPriorities)).describe("Empty means every priority."),
      due: z.enum(keys(dueFilterOptions)),
      assignment: z.enum(keys(assignmentFilterOptions)),
    }),
    sort: z.enum(keys(taskSortOptions)),
    limit: z.number().int().min(1).max(200).nullable().describe("null shows every matching task."),
    emptyText: title.describe("Shown when no task matches."),
  }),
  z.object({
    id: blockId,
    type: z.literal("memberTable"),
    title,
    columns: z.array(z.enum(keys(memberColumnOptions))).min(1),
    sort: z.enum(keys(memberSortOptions)),
  }),
  z.object({ id: blockId, type: z.literal("signatures"), title, signers: z.enum(keys(signerOptions)) }),
  z.object({ id: blockId, type: z.literal("pageBreak") }),
]);

const blocksSchema = z.array(blockSchema).min(1).max(templateLimits.blocks);

// --- Preview ---------------------------------------------------------------

function previewBlock(block: TemplateBlock, project: DocumentProject, day: string, vars: Record<string, string>) {
  switch (block.type) {
    case "heading":
      return `# ${interpolate(block.text, vars)}`;
    case "text":
      return interpolate(block.text, vars);
    case "facts":
      return [`## ${block.title}`, ...block.facts.map((key) => `- ${labelOf(variableOptions, key)}: ${vars[key]}`)].join("\n");
    case "metrics":
      return block.metrics.map((key) => `[${labelOf(variableOptions, key)}: ${vars[key]}]`).join("  ");
    case "chart":
      return `## ${block.title}\n(chart: ${labelOf(chartKindOptions, block.kind)})`;
    case "taskTable": {
      const rows = selectTasks(project, day, block.filter, block.sort, block.limit);
      const lines = rows.map(
        (task) =>
          `- ${task.title} | ${taskStatusLabels[task.status]} | ${taskPriorityLabels[task.priority]} | ` +
          `${task.assignee?.name ?? "Unassigned"} | due ${formatDay(task.deadline)}`,
      );
      return [`## ${block.title}`, ...(lines.length > 0 ? lines : [`(${block.emptyText})`])].join("\n");
    }
    case "memberTable": {
      const rows = selectMembers(project, day, block.sort);
      const lines = rows.map(
        (row) => `- ${row.person.name} | ${projectRoleLabels[row.role]} | ${row.open} open, ${row.overdue} overdue`,
      );
      return [`## ${block.title}`, ...lines].join("\n");
    }
    case "signatures":
      return `## ${block.title}\n(signature lines: ${labelOf(signerOptions, block.signers)})`;
    case "pageBreak":
      return "--- page break ---";
  }
}

// --- Tools -----------------------------------------------------------------

export const flawiuszTools: FlawiuszTool[] = [
  defineTool({
    name: "list_projects",
    title: "List projects",
    description: "Lists every project with its status, dates, size and schedule health.",
    status: "Sniffing around your projects…",
    readOnly: true,
    input: z.object({}),
    async run() {
      const projects = await getDocumentProjects();
      const day = localDay();
      return {
        ok: true,
        value: projects.map((project) => {
          const vars = buildVariables(project, day);
          return {
            id: project.id,
            name: project.name,
            status: projectStatusLabels[project.status],
            startDate: project.startDate,
            endDate: project.endDate,
            owner: project.owner.name,
            members: project.members.length,
            scheduleHealth: vars.scheduleHealth,
            tasksCompleted: vars.progress,
            timeElapsed: vars.timeElapsed,
            openTasks: Number(vars.openTasks),
            overdueTasks: Number(vars.overdueTasks),
            highPriorityOpen: Number(vars.highPriorityOpen),
          };
        }),
      };
    },
  }),

  defineTool({
    name: "get_project",
    title: "Get project",
    description:
      "Returns one project with its team, tasks and the computed values that {{variables}} resolve to today " +
      "(progress, schedule health, overdue tasks…).",
    status: "Digging into the project…",
    readOnly: true,
    input: z.object({ project_id: z.number().int().describe("Id from list_projects.") }),
    async run({ project_id }) {
      const project = await findProject(project_id);
      if (!project) return { ok: false, error: `No project with id ${project_id}. Call list_projects for valid ids.` };
      return {
        ok: true,
        value: {
          id: project.id,
          name: project.name,
          description: project.description,
          status: projectStatusLabels[project.status],
          startDate: project.startDate,
          endDate: project.endDate,
          owner: project.owner.name,
          members: project.members.map((member) => ({
            name: member.person.name,
            role: projectRoleLabels[member.role],
          })),
          tasks: project.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: taskStatusLabels[task.status],
            priority: taskPriorityLabels[task.priority],
            deadline: task.deadline,
            assignee: task.assignee?.name ?? null,
          })),
          variables: buildVariables(project, localDay()),
        },
      };
    },
  }),

  defineTool({
    name: "find_tasks",
    title: "Find tasks",
    description:
      "Finds tasks across all projects (or one project) by deadline, status, priority or assignee. " +
      "Use it for questions like what is overdue, what is due soon or what someone is working on.",
    status: "Fishing out the tasks…",
    readOnly: true,
    input: z.object({
      project_id: z.number().int().optional().describe("Limit to one project; omit to search every project."),
      due: z.enum(keys(dueFilterOptions)).optional().describe("next14 = due in the next 14 days."),
      statuses: z.array(z.enum(taskStatuses)).optional().describe("Omit for every status."),
      priorities: z.array(z.enum(taskPriorities)).optional().describe("Omit for every priority."),
      assignee: z.string().optional().describe("Part of a person's name."),
      limit: z.number().int().min(1).max(100).optional().describe("Defaults to 30."),
    }),
    async run({ project_id, due, statuses, priorities, assignee, limit }) {
      const day = localDay();
      const projects = (await getDocumentProjects()).filter((project) => !project_id || project.id === project_id);
      const filter = { statuses: statuses ?? [], priorities: priorities ?? [], due: due ?? "any", assignment: "any" as const };
      const needle = assignee?.trim().toLowerCase();

      const tasks = projects
        .flatMap((project) =>
          selectTasks(project, day, filter, "deadline", null).map((task) => ({ project: project.name, task })),
        )
        .filter(({ task }) => !needle || task.assignee?.name.toLowerCase().includes(needle))
        .sort((a, b) => (a.task.deadline ?? "9999").localeCompare(b.task.deadline ?? "9999"));

      return {
        ok: true,
        value: {
          total: tasks.length,
          tasks: tasks.slice(0, limit ?? 30).map(({ project, task }) => ({
            project,
            title: task.title,
            status: taskStatusLabels[task.status],
            priority: taskPriorityLabels[task.priority],
            deadline: task.deadline,
            assignee: task.assignee?.name ?? null,
          })),
        },
      };
    },
  }),

  defineTool({
    name: "get_team_workload",
    title: "Get team workload",
    description:
      "Counts open, overdue, high-priority and completed tasks per person across all projects (or one project). " +
      "Use it for questions about who is busy, overloaded or free.",
    status: "Counting the logs on everyone's pile…",
    readOnly: true,
    input: z.object({
      project_id: z.number().int().optional().describe("Limit to one project; omit for every project."),
    }),
    async run({ project_id }) {
      const day = localDay();
      const projects = (await getDocumentProjects()).filter((project) => !project_id || project.id === project_id);
      const people = new Map<number, { name: string; projects: string[]; open: number; overdue: number; highPriorityOpen: number; completed: number }>();

      for (const project of projects) {
        for (const row of selectMembers(project, day, "name")) {
          const person = people.get(row.person.id) ?? {
            name: row.person.name,
            projects: [],
            open: 0,
            overdue: 0,
            highPriorityOpen: 0,
            completed: 0,
          };
          person.projects.push(`${project.name} (${projectRoleLabels[row.role]})`);
          person.open += row.open;
          person.overdue += row.overdue;
          person.highPriorityOpen += row.highPriority;
          person.completed += row.completed;
          people.set(row.person.id, person);
        }
      }

      const unassignedOpen = projects.reduce((sum, project) => sum + Number(buildVariables(project, day).unassignedTasks), 0);
      return {
        ok: true,
        value: {
          people: [...people.values()].sort((a, b) => b.open - a.open || b.overdue - a.overdue),
          unassignedOpenTasks: unassignedOpen,
        },
      };
    },
  }),

  defineTool({
    name: "get_template_format",
    title: "Get template format",
    description:
      "Explains how document templates are built: block types, {{variables}}, chart kinds, table columns, " +
      "filters and limits, with a built-in template as an example. Call this before designing a template.",
    status: "Checking the blueprints…",
    readOnly: true,
    input: z.object({}),
    async run() {
      return {
        ok: true,
        value: {
          overview:
            "A template is an ordered list of blocks rendered against one project's live data. " +
            "Text and heading blocks may use {{variableKey}} placeholders. Task tables filter the project's tasks; " +
            "an empty statuses or priorities list means no restriction. Charts are drawn automatically from the data.",
          blockTypes: blockTypeOptions,
          variables: variableOptions,
          chartKinds: chartKindOptions,
          taskTable: {
            columns: taskColumnOptions,
            statuses: taskStatuses,
            priorities: taskPriorities,
            due: dueFilterOptions,
            assignment: assignmentFilterOptions,
            sort: taskSortOptions,
          },
          memberTable: { columns: memberColumnOptions, sort: memberSortOptions },
          signers: signerOptions,
          limits: templateLimits,
          example: builtInTemplates[0],
          // Last, so smaller models still have it in mind when they reply.
          reminder:
            "{{variables}} and block types are for template blocks only. When describing a template to the user, " +
            "list its sections in plain words, without placeholders or tables.",
        },
      };
    },
  }),

  defineTool({
    name: "list_templates",
    title: "List templates",
    description: "Lists built-in and saved custom templates with their blocks.",
    status: "Rummaging through the templates…",
    readOnly: true,
    input: z.object({}),
    async run() {
      return { ok: true, value: await getDocumentTemplates() };
    },
  }),

  defineTool({
    name: "preview_template",
    title: "Preview template",
    description:
      "Renders a template against a project as plain text, so you can check the wording and that tables " +
      "are not empty. Pass either template_id (an existing template) or blocks (a draft).",
    status: "Test-building the template…",
    readOnly: true,
    input: z.object({
      project_id: z.number().int(),
      template_id: z.string().optional().describe('E.g. "builtin-status-report" or "custom-3".'),
      blocks: blocksSchema.optional(),
    }),
    async run({ project_id, template_id, blocks }) {
      const project = await findProject(project_id);
      if (!project) return { ok: false, error: `No project with id ${project_id}. Call list_projects for valid ids.` };

      let templateBlocks: TemplateBlock[];
      if (blocks) {
        templateBlocks = parseBlocks(blocks);
      } else if (template_id) {
        const template = (await getDocumentTemplates()).find((candidate) => candidate.id === template_id);
        if (!template) return { ok: false, error: `No template with id ${template_id}.` };
        templateBlocks = template.blocks;
      } else {
        return { ok: false, error: "Pass template_id or blocks." };
      }

      const day = localDay();
      const vars = buildVariables(project, day);
      const preview = templateBlocks.map((block) => previewBlock(block, project, day, vars)).join("\n\n");
      // Small models tend to report a previewed draft as saved; say plainly that it isn't.
      const note = blocks ? "\n\n[This is only a preview of a draft. It is NOT saved — call save_template to save it.]" : "";
      return { ok: true, value: preview + note };
    },
  }),

  defineTool({
    name: "save_template",
    title: "Save template",
    description:
      "Saves a custom document template so it appears on the app's Documents page. " +
      "Omit template_id to create a new one; pass a custom template's id to replace it. Built-ins cannot be changed.",
    status: "Stacking the template log by log…",
    readOnly: false,
    input: z.object({
      template_id: z.string().optional().describe('A custom template id such as "custom-3".'),
      name: z.string().min(1).max(templateLimits.name),
      description: z.string().max(templateLimits.description).optional(),
      blocks: blocksSchema,
    }),
    async run({ template_id, name, description, blocks }) {
      const result = await saveTemplate(template_id ?? null, { name, description: description ?? "", blocks });
      if (!result.ok) return result;
      return { ok: true, value: { id: result.value.id, name: result.value.name, blocks: result.value.blocks.length } };
    },
  }),
];

// Validates the model's raw arguments and runs the tool.
export async function runTool(name: string, args: unknown): Promise<ToolResult> {
  const tool = flawiuszTools.find((candidate) => candidate.name === name);
  if (!tool) return { ok: false, error: `Unknown tool ${name}.` };

  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) return { ok: false, error: `Invalid arguments:\n${z.prettifyError(parsed.error)}` };

  try {
    return await tool.run(parsed.data);
  } catch (error) {
    console.error(`Flawiusz tool ${name} failed`, error);
    return { ok: false, error: "The tool failed unexpectedly. Try again." };
  }
}
