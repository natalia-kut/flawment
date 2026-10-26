import { z } from "zod";
import { llmConfig, streamCompletion, type ChatMessage, type ToolSpec } from "./llm";
import { randomBusyPhrase, unavailableMessage } from "./phrases";
import { systemPrompt } from "./prompt";
import { flawiuszTools, runTool, type ProjectChoice, type TemplateProposal, type ToolContext } from "./tools/tool-list";

// The chat loop: ask the model, run the tools it calls, feed the results back,
// and stream visible text to the browser as it arrives.

export type ConversationMessage = { role: "user" | "assistant"; content: string };

export type AgentEvent =
  | { type: "status"; label: string }
  | { type: "text"; text: string }
  | { type: "template"; id: string; name: string }
  | { type: "proposal"; proposal: TemplateProposal }
  | { type: "projects"; projects: ProjectChoice[] }
  | { type: "error"; message: string };

const maxSteps = 10;

const toolSpecs: ToolSpec[] = flawiuszTools.map((tool) => ({
  type: "function",
  function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.input) },
}));

export async function runFlawiusz(
  conversation: ConversationMessage[],
  emit: (event: AgentEvent) => void,
  signal: AbortSignal,
  context: ToolContext,
) {
  const config = llmConfig();
  if (!config) {
    console.error("Flawiusz is not configured: set LLM_BASE_URL, LLM_MODEL and LLM_API_KEY in .env.");
    emit({ type: "error", message: unavailableMessage });
    return;
  }

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(context.chosenProjectId) }, ...conversation];
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
    let question: string | undefined;

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
          : await runTool(call.function.name, args, context);

      let content = result.ok && typeof result.value === "string" ? result.value : JSON.stringify(result);
      if (result.ok && tool?.show) {
        const outcome = tool.show(result.value, emit);
        content = outcome.content ?? content;
        question ??= outcome.question;
      }

      messages.push({ role: "tool", tool_call_id: call.id, content });
    }

    if (question) {
      if (!startedStep) emit({ type: "text", text: `${wroteText ? "\n\n" : ""}${question}` });
      return;
    }
  }
}
