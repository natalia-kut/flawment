import { z } from "zod";
import type { FlawiuszTool, ToolContext, ToolResult } from "./define";
import { getTemplateFormat, listTemplates, proposeTemplate, saveTemplateTool } from "./documents";
import { askProject, listProjects } from "./projects";

export type { FlawiuszTool, ToolContext, ToolResult } from "./define";
export type { TemplateProposal } from "./documents";
export type { ProjectChoice } from "./projects";

export const flawiuszTools: FlawiuszTool[] = [
  getTemplateFormat,
  listProjects,
  askProject,
  listTemplates,
  proposeTemplate,
  saveTemplateTool,
];

export async function runTool(name: string, args: unknown, context: ToolContext): Promise<ToolResult> {
  const tool = flawiuszTools.find((candidate) => candidate.name === name);
  if (!tool) return { ok: false, error: `Unknown tool ${name}.` };

  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid arguments, so nothing was done. Fix them and call ${name} again:\n${z.prettifyError(parsed.error)}` };
  }

  try {
    return await tool.run(parsed.data, context);
  } catch (error) {
    console.error(`Flawiusz tool ${name} failed`, error);
    return { ok: false, error: "The tool failed unexpectedly. Try again." };
  }
}
