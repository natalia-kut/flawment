import { z } from "zod";
import { llmConfig, noThinkSwitch, streamCompletion, type ChatMessage, type ToolSpec } from "./llm";
import { randomBusyPhrase } from "./phrases";
import { localDay } from "@/lib/documents/engine";
import { flawiuszTools, runTool } from "./tools";

// The chat loop: ask the model, run the tools it calls, feed the results back,
// and stream visible text to the browser as it arrives.

export type ConversationMessage = { role: "user" | "assistant"; content: string };

export type AgentEvent =
  | { type: "status"; label: string }
  | { type: "text"; text: string }
  | { type: "template"; id: string; name: string }
  | { type: "error"; message: string };

const maxSteps = 10;

const toolSpecs: ToolSpec[] = flawiuszTools.map((tool) => ({
  type: "function",
  function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.input) },
}));

function systemPrompt() {
  return [
    "You are Flawiusz, a friendly beaver and the assistant built into Flawment, " +
    "a project management app. Today is " + localDay() + ".",
    "Always reply in the same language as the user's latest message. " +
    "Keep answers short and concrete; use short lists when they help.",
    "Always read real data with the tools before answering questions about projects, tasks or people; " +
    "never invent projects, tasks, people or numbers. When the user doesn't name a project, look across all of them. " +
    "Use list_projects for project health, find_tasks for deadlines and who works on what, and " +
    "get_team_workload for who is busy or free. Refer to projects by name, not by id. " +
    "Keep project names, task titles and people's names exactly as in the data; never translate them. " +
    "Nobody is signed in yet, so when the user asks about their own tasks or what they have to do, " +
    "show the matching tasks across all projects.",
    "To create a document template: call get_template_format, then call save_template with the blocks right away " +
    "(the app validates them). Use preview_template only when the user wants to see a draft on real data first. " +
    "Template names and texts are always in English, like the rest of the app. " +
    "When you propose a template before saving it, reply with a short numbered list of its sections, " +
    "one plain-language line each (e.g. '2. Key figures: schedule health, share of tasks completed, overdue tasks'). " +
    "Never show {{variables}}, block types, ids, tables or horizontal rules in your reply — " +
    "placeholders only go into the blocks you pass to the tools. " +
    "Only say a template is saved after save_template succeeded; then tell the user they can find it " +
    "on the Documents page. If the user asked you to create a template, save it — don't stop at the preview.",
    "You cannot create or change projects, tasks or team members yet. If asked, say so briefly " +
    "and help in another way, for example by suggesting task names as a list.",
  ].join("\n\n");
}

export async function runFlawiusz(
  conversation: ConversationMessage[],
  // Let the model reason before answering: better on complex requests, much slower.
  thinking: boolean,
  emit: (event: AgentEvent) => void,
  signal: AbortSignal,
) {
  const config = llmConfig();
  if (!config) {
    emit({ type: "error", message: "Flawiusz is not set up yet. Add LLM_BASE_URL and LLM_MODEL to .env." });
    return;
  }

  const system = systemPrompt() + (thinking ? "" : noThinkSwitch);
  const messages: ChatMessage[] = [{ role: "system", content: system }, ...conversation];
  let wroteText = false;

  for (let step = 0; step < maxSteps; step++) {
    emit({ type: "status", label: randomBusyPhrase() });

    let startedStep = false;
    const reply = await streamCompletion(
      config,
      messages,
      toolSpecs,
      (text) => {
        // Separate text written before and after tool calls.
        if (!startedStep && wroteText) text = `\n\n${text}`;
        startedStep = wroteText = true;
        emit({ type: "text", text });
      },
      signal,
    );

    if (reply.toolCalls.length === 0) return;
    messages.push({ role: "assistant", content: reply.content, tool_calls: reply.toolCalls });

    for (const call of reply.toolCalls) {
      const tool = flawiuszTools.find((candidate) => candidate.name === call.function.name);
      emit({ type: "status", label: tool?.status ?? "Working…" });

      let args: unknown;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = null;
      }
      const result =
        args === null
          ? { ok: false as const, error: "Arguments were not valid JSON. Try again." }
          : await runTool(call.function.name, args);

      if (result.ok && call.function.name === "save_template") {
        const saved = result.value as { id: string; name: string };
        emit({ type: "template", id: saved.id, name: saved.name });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.ok && typeof result.value === "string" ? result.value : JSON.stringify(result),
      });
    }
  }

  emit({ type: "text", text: "\n\nI had to stop here — this took more steps than I'm allowed. Try a more specific request." });
}
