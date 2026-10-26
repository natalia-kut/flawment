import { z } from "zod";
import { saveTemplate } from "@/lib/documents/actions";
import { builtInTemplates } from "@/lib/documents/built-in-templates";
import { getDocumentProjects, getDocumentTemplates } from "@/lib/documents/data";
import {
  assignmentFilterOptions,
  blockTypeOptions,
  chartKindOptions,
  dueFilterOptions,
  memberColumnOptions,
  memberSortOptions,
  parseTemplateInput,
  signerOptions,
  taskColumnOptions,
  taskSortOptions,
  templateLimits,
  variableOptions,
  type TemplateInput,
} from "@/lib/documents/template-schema";
import { taskPriorities, taskStatuses } from "@/lib/documents/types";
import { defineTool, type ToolContext } from "./define";

function keys<T extends readonly { key: string }[]>(options: T) {
  return options.map((option) => option.key) as [T[number]["key"], ...T[number]["key"][]];
}

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
    text: z
      .string()
      .max(templateLimits.text)
      .describe("Plain text without Markdown; one paragraph per line. May contain {{variables}}."),
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

// Models often double-escape line breaks ("\\n" arrives as a literal backslash
// and n) and format with Markdown, which the document renders as plain text.
function plainText(text: string) {
  return text
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*/g, (_, bold, underscored, italic) => bold ?? underscored ?? italic);
}

function cleanBlock(block: z.infer<typeof blockSchema>) {
  if (block.type === "text" || block.type === "heading") return { ...block, text: plainText(block.text) };
  return block;
}

const templateSchema = z.object({
  template_id: z.string().optional().describe('A custom template id such as "custom-3", to replace that template.'),
  name: z.string().min(1).max(templateLimits.name),
  description: z.string().max(templateLimits.description).optional(),
  project_id: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe("Required for a new template: a project id from list_projects or ask_project, or null for all of the user's projects. Ignored when replacing a template."),
  blocks: blocksSchema,
});

export type TemplateProposal = TemplateInput & {
  templateId: string | null;
  // null: available in all of the user's projects.
  projectId: number | null;
  projectName: string | null;
};

// Turns the model's arguments into what the app stores. Replacing a template
// keeps the settings the model does not know about.
async function prepareTemplate(
  { template_id, name, description, project_id, blocks }: z.infer<typeof templateSchema>,
  { chosenProjectId }: ToolContext,
) {
  const existing = template_id
    ? (await getDocumentTemplates()).find((template) => template.id === template_id && !template.isBuiltIn)
    : undefined;
  if (template_id && !existing) return { ok: false as const, error: `There is no custom template ${template_id}.` };

  // A saved template stays in its project; a new one needs an explicit choice.
  const projectId = existing ? existing.projectId : (project_id === undefined ? chosenProjectId : project_id);
  if (projectId === undefined) {
    return {
      ok: false as const,
      error:
        "project_id is missing. Pass the id of the project the user chose, or null if they chose all projects. " +
        "If you do not know yet, ask the user.",
    };
  }
  const project = projectId === null ? null : (await getDocumentProjects()).find((item) => item.id === projectId);
  if (project === undefined) return { ok: false as const, error: `There is no project ${projectId}; use an id from list_projects or ask_project.` };

  const parsed = parseTemplateInput({
    name,
    description: description ?? existing?.description ?? "",
    blocks: blocks.map(cleanBlock),
    showStatus: existing?.showStatus,
    showName: existing?.showName,
  });
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    value: {
      ...parsed.value,
      templateId: template_id ?? null,
      projectId,
      projectName: project?.name ?? null,
    } satisfies TemplateProposal,
  };
}

export const getTemplateFormat = defineTool({
  name: "get_template_format",
  description:
    "Explains how document templates are built: block types, {{variables}}, chart kinds, table columns, " +
    "filters and limits, with a built-in template as an example. Call this before designing a template.",
  status: "Checking the blueprints…",
  input: z.object({}),
  async run() {
    return {
      ok: true,
      value: {
        overview:
          "A template is an ordered list of blocks rendered against one project's live data. " +
          "Text and heading blocks may use {{variableKey}} placeholders. Task tables filter the project's tasks; " +
          "an empty statuses or priorities list means no restriction. Charts are drawn automatically from the data.",
        header:
          "Every document starts with a fixed header above the blocks: the template name, the project name and " +
          "description, the schedule health, the owner, the project period (start and end dates), the team size " +
          "and the date the document was generated. Do not add blocks that repeat it, such as a heading with the " +
          "project name or today's date, or facts with the owner or project dates.",
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
          "Nothing is saved yet. Show the template with propose_template; the user saves it from there. " +
          "{{variables}} and block types are for template blocks only, never for replies. " +
          "The header already shows the project name, owner, dates and generation date; start with the content.",
      },
    };
  },
});

export const listTemplates = defineTool({
  name: "list_templates",
  description: "Lists built-in and saved custom templates with their blocks.",
  status: "Rummaging through the templates…",
  input: z.object({}),
  async run() {
    return { ok: true, value: await getDocumentTemplates() };
  },
});

export const proposeTemplate = defineTool({
  name: "propose_template",
  description:
    "Shows a template to the user as a card with a live preview and a Save button. Nothing is saved. " +
    "Pass template_id to propose changes to an existing custom template.",
  status: "Sketching the template…",
  input: templateSchema,
  run: prepareTemplate,
  show(proposal, emit) {
    emit({ type: "proposal", proposal });
    return { content: "The user now sees the proposal as a card with a preview and a Save button. Nothing is saved yet." };
  },
});

export const saveTemplateTool = defineTool({
  name: "save_template",
  description:
    "Saves a custom document template so it appears on the app's Documents page. Only use it when the user " +
    "asks you to save without a proposal. Omit template_id to create a new one; pass a custom template's id " +
    "to replace it. Built-ins cannot be changed.",
  status: "Stacking the template log by log…",
  input: templateSchema,
  async run(args, context) {
    const prepared = await prepareTemplate(args, context);
    if (!prepared.ok) return prepared;
    const result = await saveTemplate(prepared.value.templateId, prepared.value, prepared.value.projectId);
    if (!result.ok) return result;
    return { ok: true, value: { id: result.value.id, name: result.value.name, blocks: result.value.blocks.length } };
  },
  show({ id, name }, emit) {
    emit({ type: "template", id, name });
    return {};
  },
});
