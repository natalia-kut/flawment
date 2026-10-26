"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveTemplate } from "@/lib/documents/actions";
import type { AgentEvent } from "@/lib/flawiusz/agent";
import { busyPhrases, unavailableMessage } from "@/lib/flawiusz/phrases";
import type { ProjectChoice, TemplateProposal } from "@/lib/flawiusz/tools/tool-list";
import { blockDetail, blockLabels } from "./labels";

// Shown when the user stops Flawiusz before it wrote anything; never sent back to the model.
const stoppedText = "*The request was interrupted*";

type SavedTemplate = { id: string; name: string };

export type ChatProposal = TemplateProposal & { savedId?: string; saving?: boolean; error?: string };

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  templates: SavedTemplate[];
  proposals: ChatProposal[];
  // Projects offered as buttons when Flawiusz asks which project a template is for.
  projectChoices: ProjectChoice[];
  // On a user message sent with one of those buttons: the project id, or null for all projects.
  chosenProjectId?: number | null;
  error?: string;
};

// Saved templates and proposals are not part of the visible text, so remind the
// model of them on later turns (it needs the id or the sections to change them).
function historyContent(message: Message) {
  const notes = message.templates.map((template) => `\n[Saved template "${template.name}" (${template.id})]`);
  if (message.projectChoices.length > 0) {
    const choices = message.projectChoices.map((project) => `"${project.name}" = project_id ${project.id}`);
    notes.push(`\n[Showed project buttons: ${choices.join("; ")}; "All my projects" = project_id null]`);
  }
  for (const proposal of message.proposals) {
    if (proposal.savedId) {
      notes.push(`\n[Saved template "${proposal.name}" (${proposal.savedId})]`);
      continue;
    }
    const sections = proposal.blocks.map((block, index) => `${index + 1}. ${blockLabels[block.type]}: ${blockDetail(block)}`);
    const target = proposal.templateId ? ` replacing ${proposal.templateId}` : "";
    const scope = proposal.projectId === null ? "all projects" : `project ${proposal.projectId}`;
    notes.push(`\n[Proposed template "${proposal.name}"${target} for ${scope}, not saved yet. Sections: ${sections.join("; ")}]`);
  }
  return message.content + notes.join("");
}

// One conversation shared by the dashboard and the side panel, so a chat started
// on the dashboard continues on every other page.
export function useFlawiuszChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  // The current step while Flawiusz is working; null when idle.
  const [status, setStatus] = useState<string | null>(null);
  const nextId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const busy = status !== null;

  async function send(text: string, chosenProjectId?: number | null) {
    const prompt = text.trim();
    if (!prompt || busy) return;

    const question: Message = {
      id: nextId.current++,
      role: "user",
      content: prompt,
      templates: [],
      proposals: [],
      projectChoices: [],
      chosenProjectId,
    };
    // The latest pick, so Flawiusz does not have to work it out from the text.
    // A saved template ends it, so the next template gets its own question.
    let chosen: number | null | undefined;
    for (const message of [...messages, question].reverse()) {
      if (message.templates.length > 0 || message.proposals.some((proposal) => proposal.savedId)) break;
      if (message.chosenProjectId !== undefined) {
        chosen = message.chosenProjectId;
        break;
      }
    }
    const reply: Message = { id: nextId.current++, role: "assistant", content: "", templates: [], proposals: [], projectChoices: [] };
    // Keep replies with templates even without text, so the model still knows about them.
    const keep = (message: Message) =>
      message.templates.length > 0 ||
      message.proposals.length > 0 ||
      message.projectChoices.length > 0 ||
      (message.content && message.content !== stoppedText && !message.error);
    const history = [...messages.filter(keep), question].map(
      (message) => ({ role: message.role, content: historyContent(message) }),
    );
    const update = (change: (message: Message) => Message) =>
      setMessages((current) => current.map((message) => (message.id === reply.id ? change(message) : message)));

    setMessages((current) => [...current, question, reply]);
    setStatus(busyPhrases[0]);
    const controller = new AbortController();
    abortRef.current = controller;

    const handle = (event: AgentEvent) => {
      switch (event.type) {
        case "status":
          setStatus(event.label);
          break;
        case "text":
          update((message) => ({ ...message, content: message.content + event.text }));
          break;
        case "template":
          update((message) => ({ ...message, templates: [...message.templates, { id: event.id, name: event.name }] }));
          router.refresh();
          break;
        case "projects":
          update((message) => ({ ...message, projectChoices: event.projects }));
          break;
        case "proposal":
          update((message) => ({ ...message, proposals: [...message.proposals, event.proposal] }));
          break;
        case "error":
          update((message) => ({ ...message, error: event.message }));
          break;
      }
    };

    try {
      const response = await fetch("/api/flawiusz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, chosenProjectId: chosen }),
        signal: controller.signal,
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !response.body) throw new Error(`Chat request failed with ${response.status}`);

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as AgentEvent);
      }
    } catch {
      update((message) =>
        controller.signal.aborted
          ? { ...message, content: message.content || stoppedText }
          : { ...message, error: unavailableMessage },
      );
    } finally {
      abortRef.current = null;
      setStatus(null);
    }
  }

  // Saved straight from the card, without asking the model again.
  async function saveProposal(messageId: number, index: number) {
    const proposal = messages.find((message) => message.id === messageId)?.proposals[index];
    if (!proposal || proposal.saving || proposal.savedId) return;

    const change = (patch: Partial<ChatProposal>) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, proposals: message.proposals.map((item, i) => (i === index ? { ...item, ...patch } : item)) }
            : message,
        ),
      );

    change({ saving: true, error: undefined });
    try {
      const result = await saveTemplate(proposal.templateId, proposal, proposal.projectId);
      if (!result.ok) {
        change({ saving: false, error: result.error });
        return;
      }
      change({ saving: false, savedId: result.value.id });
      router.refresh();
    } catch {
      change({ saving: false, error: "The template could not be saved. Try again." });
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    stop();
    setMessages([]);
  }

  return { messages, status, busy, send, saveProposal, stop, reset };
}

export type FlawiuszChat = ReturnType<typeof useFlawiuszChat>;
