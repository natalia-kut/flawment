import { z } from "zod";
import { saveTemplate } from "@/lib/documents/actions";
import { builtInTemplates } from "@/lib/documents/built-in-templates";
import { getDocumentTemplates } from "@/lib/documents/data";
import {
  assignmentFilterOptions,
  blockTypeOptions,
  chartKindOptions,
  dueFilterOptions,
  memberColumnOptions,
  memberSortOptions,
  signerOptions,
  taskColumnOptions,
  taskSortOptions,
  templateLimits,
  variableOptions,
} from "@/lib/documents/template-schema";
import { taskPriorities, taskStatuses } from "@/lib/documents/types";

// Flawiusz's tools for the in-app chat (lib/flawiusz/agent.ts).

type ToolResult = { ok: true; value: unknown } | { ok: false; error: string };

type ToolDefinition<Input extends z.ZodObject> = {
  name: string;
  description: string;
  // Shown in the chat while the tool runs.
  status: string;
  input: Input;
  run: (args: z.infer<Input>) => Promise<ToolResult>;
};

type FlawiuszTool = ToolDefinition<z.ZodObject>;

function defineTool<Input extends z.ZodObject>(tool: ToolDefinition<Input>) {
  return tool as unknown as FlawiuszTool;
}

function keys<T extends readonly { key: string }[]>(options: T) {
  return options.map((option) => option.key) as [T[number]["key"], ...T[number]["key"][]];
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

// --- Tools -----------------------------------------------------------------

export const flawiuszTools: FlawiuszTool[] = [
  defineTool({
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
            "Nothing is saved yet. Propose the template first; call save_template once the user confirms. " +
            "{{variables}} and block types are for template blocks only. When describing a template to the user, " +
            "list its sections in plain words, without placeholders or tables.",
        },
      };
    },
  }),

  defineTool({
    name: "list_templates",
    description: "Lists built-in and saved custom templates with their blocks.",
    status: "Rummaging through the templates…",
    input: z.object({}),
    async run() {
      return { ok: true, value: await getDocumentTemplates() };
    },
  }),

  defineTool({
    name: "save_template",
    description:
      "Saves a custom document template so it appears on the app's Documents page. " +
      "Omit template_id to create a new one; pass a custom template's id to replace it. Built-ins cannot be changed.",
    status: "Stacking the template log by log…",
    input: z.object({
      template_id: z.string().optional().describe('A custom template id such as "custom-3".'),
      name: z.string().min(1).max(templateLimits.name),
      description: z.string().max(templateLimits.description).optional(),
      blocks: blocksSchema,
    }),
    async run({ template_id, name, description, blocks }) {
      const result = await saveTemplate(template_id ?? null, {
        name,
        description: description ?? "",
        blocks: blocks.map(cleanBlock),
      });
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
  if (!parsed.success) {
    return { ok: false, error: `Invalid arguments, so nothing was done. Fix them and call ${name} again:\n${z.prettifyError(parsed.error)}` };
  }

  try {
    return await tool.run(parsed.data);
  } catch (error) {
    console.error(`Flawiusz tool ${name} failed`, error);
    return { ok: false, error: "The tool failed unexpectedly. Try again." };
  }
}
