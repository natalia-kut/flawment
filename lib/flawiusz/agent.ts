import { z } from "zod";
import { llmConfig, streamCompletion, type ChatMessage, type ToolSpec } from "./llm";
import { randomBusyPhrase, unavailableMessage } from "./phrases";
import { localDay } from "@/lib/documents/engine";
import { flawiuszTools, runTool, type ProjectChoice, type TemplateProposal, type ToolContext } from "./tools";

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

function systemPrompt(chosenProjectId: number | null | undefined) {
  const choice =
    chosenProjectId === undefined
      ? []
      : [
          "The user already chose with the project buttons: " +
          (chosenProjectId === null ? "all of their projects (project_id null)" : `project_id ${chosenProjectId}`) +
          ". Use it for new templates and do not ask about the project again.",
        ];
  return [
    "You are Flawiusz, a friendly beaver and the assistant built into Flawment, " +
    "a project management app. Today is " + localDay() + ".",
    "Always reply in the language of the user's latest message (for example, " +
    "Polish if they write in Polish), even though templates are in English. " +
    "Be concise, concrete and friendly.",
    "For now you can only create document templates. You cannot read project, " +
    "task or team data yet; if asked about it, say so briefly and offer to " +
    "draft a template instead. Never invent data.",
    "Before proposing a new template, find out which project it is for, or " +
    "whether it should be available in all of the user's projects. If the " +
    "conversation already makes it clear, or the user has only one project, " +
    "call list_projects to get the id. Otherwise write one short question, " +
    "without listing the projects, and call ask_project in the same reply: the " +
    "app shows the projects as buttons and your turn ends there. A template always uses one project's data at a " +
    "time; reports that combine several projects are not possible yet.",
    "When creating or changing a document template, call get_template_format " +
    "first, then call propose_template. The app shows the proposal as a card " +
    "listing its sections, with a live preview and a Save button, so do not list " +
    "the sections again: add at most one or two short sentences, for example what " +
    "the template is good for. The user saves it with the button or asks you for " +
    "changes; for changes, call propose_template again with the whole updated " +
    "template. Call save_template only if the user explicitly asks you to save " +
    "without showing a proposal. Keep existing template " +
    "names exactly as stored; do not translate them. Template names and content " +
    "must always be in English. Never show placeholders, block types, IDs or raw " +
    "template structure in replies. Confirm saving only after save_template " +
    "succeeds, then tell the user the template is available on the Documents page.",
    "You cannot create or modify projects, tasks or team members. Say so " +
    "briefly and offer a useful alternative, such as suggesting task names.",
    "Never narrate your work with tools: do not mention tool names, " +
    "parameters, ids, null or how you call things. If a tool rejects your " +
    "arguments, fix them and call it again without commenting. Tell the user " +
    "about a failure only when you cannot fix it, in plain words, and never " +
    "claim an action succeeded unless the tool confirms it.",
    ...choice,
  ].join("\n\n");
}

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
    let askedForProject = false;

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

      if (result.ok && call.function.name === "save_template") {
        const saved = result.value as { id: string; name: string };
        emit({ type: "template", id: saved.id, name: saved.name });
      }

      let content = result.ok && typeof result.value === "string" ? result.value : JSON.stringify(result);
      if (result.ok && call.function.name === "ask_project") {
        emit({ type: "projects", projects: result.value as ProjectChoice[] });
        askedForProject = true;
      }
      if (result.ok && call.function.name === "propose_template") {
        emit({ type: "proposal", proposal: result.value as TemplateProposal });
        content = "The user now sees the proposal as a card with a preview and a Save button. Nothing is saved yet.";
      }

      messages.push({ role: "tool", tool_call_id: call.id, content });
    }

    // The buttons are the question, so wait for the user instead of letting the
    // model ask again in words.
    if (askedForProject) {
      if (!startedStep) emit({ type: "text", text: `${wroteText ? "\n\n" : ""}Which project is this template for?` });
      return;
    }
  }
}
