import { z } from "zod";
import { llmConfig, streamCompletion, type ChatMessage, type ToolSpec } from "./llm";
import { randomBusyPhrase, stuckMessage, unavailableMessage } from "./phrases";
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

// Failsafe: ends the turn if the model keeps repeating the same tool call.
const maxIdenticalCalls = 3;

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

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...conversation];
  const callCounts = new Map<string, number>();
  let wroteText = false;

  for (;;) {
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
    messages.push({ role: "assistant", content: reply.content, reasoning: reply.reasoning, tool_calls: reply.toolCalls });
    let question: string | undefined;

    for (const call of reply.toolCalls) {
      const signature = `${call.function.name}:${call.function.arguments}`;
      const count = (callCounts.get(signature) ?? 0) + 1;
      if (count > maxIdenticalCalls) {
        console.error(`Flawiusz stopped: ${call.function.name} called more than ${maxIdenticalCalls} times with the same arguments.`);
        emit({ type: "error", message: stuckMessage });
        return;
      }
      callCounts.set(signature, count);

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
