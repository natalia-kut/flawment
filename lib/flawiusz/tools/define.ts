import type { z } from "zod";
import type { AgentEvent } from "@/lib/flawiusz/agent";

export type ToolResult<Value = unknown> = { ok: true; value: Value } | { ok: false; error: string };

// The project the user picked with the buttons in this chat: an id, null for
// all projects, or undefined when they have not picked one.
export type ToolContext = { chosenProjectId: number | null | undefined };

// What a successful call changes in the chat besides the streamed text.
export type ToolOutcome = {
  // Sent back to the model instead of the raw result.
  content?: string;
  // Ends the turn after this step so the user can answer with buttons; written
  // out when the model said nothing in that step.
  question?: string;
};

type ToolDefinition<Input extends z.ZodObject, Output> = {
  name: string;
  description: string;
  // Shown in the chat while the tool runs.
  status: string;
  input: Input;
  run: (args: z.infer<Input>, context: ToolContext) => Promise<ToolResult<Output>>;
  show?: (value: Output, emit: (event: AgentEvent) => void) => ToolOutcome;
};

export type FlawiuszTool = ToolDefinition<z.ZodObject, unknown>;

export function defineTool<Input extends z.ZodObject, Output>(tool: ToolDefinition<Input, Output>) {
  return tool as unknown as FlawiuszTool;
}
