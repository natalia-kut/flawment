import { z } from "zod";
import { llmConfig, noThinkSwitch, streamCompletion, type ChatMessage, type ToolSpec } from "./llm";
import { randomBusyPhrase, unavailableMessage } from "./phrases";
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
    "Always reply in the language of the user's latest message (for example, " +
    "Polish if they write in Polish), even though templates are in English. " +
    "Be concise, concrete and friendly.",
    "For now you can only create document templates. You cannot read project, " +
    "task or team data yet; if asked about it, say so briefly and offer to " +
    "draft a template instead. Never invent data.",
    "When creating a document template, call get_template_format first. Then " +
    "propose the template: its name and a short numbered list of sections with " +
    "one plain-language line per section, and ask whether to save it or change " +
    "something. Call save_template only after the user confirms, or right away " +
    "if they explicitly asked to save without a proposal. Keep existing template " +
    "names exactly as stored; do not translate them. Template names and content " +
    "must always be in English. Never show placeholders, block types, IDs or raw " +
    "template structure in replies. Confirm saving only after save_template " +
    "succeeds, then tell the user the template is available on the Documents page.",
    "You cannot create or modify projects, tasks or team members. Say so " +
    "briefly and offer a useful alternative, such as suggesting task names.",
    "If a tool fails, say so instead of guessing. Never claim an action " +
    "succeeded unless the tool confirms it.",
  ].join("\n\n");
}

export async function runFlawiusz(
  conversation: ConversationMessage[],
  emit: (event: AgentEvent) => void,
  signal: AbortSignal,
) {
  const config = llmConfig();
  if (!config) {
    console.error("Flawiusz is not configured: set LLM_BASE_URL and LLM_MODEL in .env.");
    emit({ type: "error", message: unavailableMessage });
    return;
  }

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt() + noThinkSwitch }, ...conversation];
  let wroteText = false;

  for (let step = 0; step < maxSteps; step++) {
    emit({ type: "status", label: randomBusyPhrase() });

    // On the last step, take the tools away so the model has to wrap up in the user's language.
    const lastStep = step === maxSteps - 1;
    if (lastStep) {
      // A user turn, since some chat templates reject a system message mid-conversation.
      messages.push({
        role: "user",
        content: "(Automatic note) You have used all your steps. Answer now with what you have, and say what is still unfinished.",
      });
    }

    let startedStep = false;
    const reply = await streamCompletion(
      config,
      messages,
      lastStep ? [] : toolSpecs,
      (text) => {
        // Separate text written before and after tool calls.
        if (!startedStep && wroteText) text = `\n\n${text}`;
        startedStep = wroteText = true;
        emit({ type: "text", text });
      },
      signal,
    );

    if (reply.toolCalls.length === 0 || lastStep) return;
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
}
