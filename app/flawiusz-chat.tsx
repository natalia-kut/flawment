"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { saveTemplate } from "@/lib/documents/actions";
import {
  blockTypeOptions,
  chartKindOptions,
  variableOptions,
  type DocumentTemplate,
  type TemplateBlock,
} from "@/lib/documents/template-schema";
import type { AgentEvent } from "@/lib/flawiusz/agent";
import { busyPhrases, unavailableMessage } from "@/lib/flawiusz/phrases";
import type { ProjectChoice, TemplateProposal } from "@/lib/flawiusz/tools";
import TemplatePreviewDialog from "./template-preview-dialog";
import "./flawiusz.css";

// Shown when the user stops Flawiusz before it wrote anything; never sent back to the model.
const stoppedText = "*The request was interrupted*";

type SavedTemplate = { id: string; name: string };

type ChatProposal = TemplateProposal & { savedId?: string; saving?: boolean; error?: string };

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

const variableLabels: Record<string, string> = Object.fromEntries(
  variableOptions.map((option) => [option.key, option.label.toLowerCase()]),
);

const blockLabels = Object.fromEntries(blockTypeOptions.map((option) => [option.type, option.label])) as Record<
  TemplateBlock["type"],
  string
>;
const chartLabels: Record<string, string> = Object.fromEntries(chartKindOptions.map((option) => [option.key, option.label]));

// What a block shows, in a few words.
function blockDetail(block: TemplateBlock) {
  switch (block.type) {
    case "heading":
    case "text":
      return humanize(block.text).replace(/\s+/g, " ");
    case "chart":
      return block.title || chartLabels[block.kind];
    case "metrics":
      return block.metrics.map((key) => variableLabels[key] ?? key).join(", ");
    case "facts":
    case "taskTable":
    case "memberTable":
    case "signatures":
      return block.title;
    case "pageBreak":
      return "";
  }
}

// Small models sometimes leak template placeholders into replies; show them as plain words.
function humanize(text: string) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => variableLabels[key] ?? key.replace(/\./g, " "));
}

function inline(text: string) {
  return humanize(text).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).map((part, index) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

type ListItem = { text: string; children: string[] };

// Just enough Markdown for chat replies: paragraphs, headings, lists (one level of
// nesting), bold, italics and code.
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; start: number; items: ListItem[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, index) => (
      <li key={index}>
        {inline(item.text)}
        {item.children.length > 0 && (
          <ul>
            {item.children.map((child, childIndex) => (
              <li key={childIndex}>{inline(child)}</li>
            ))}
          </ul>
        )}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        // Keep the model's numbering when a list is interrupted, instead of restarting at 1.
        <ol key={blocks.length} start={list.start}>{items}</ol>
      ) : (
        <ul key={blocks.length}>{items}</ul>
      ),
    );
    list = null;
  };

  for (const line of text.split("\n")) {
    const item = /^(\s*)(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(line);
    const indented = /^\s{2,}\S/.test(line);
    const lastItem = list?.items.at(-1);

    // Indented lines under a list item belong to that item.
    if (indented && lastItem) {
      lastItem.children.push(item ? item[4] : line.trim());
      continue;
    }
    if (item) {
      const ordered = !item[2];
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, start: ordered ? Number(item[3]) : 1, items: [] };
      list.items.push({ text: item[4], children: [] });
      continue;
    }
    // Blank lines between list items don't end the list; horizontal rules are just noise in a chat.
    if (!line.trim() || /^\s*([-*_])\1{2,}\s*$/.test(line)) continue;
    flushList();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) blocks.push(<p className="chat-heading" key={blocks.length}>{inline(heading[1])}</p>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flushList();
  return <>{blocks}</>;
}

export function ChatLog({
  chat,
  onOpenTemplate,
  className,
}: {
  chat: FlawiuszChat;
  onOpenTemplate: (templateId: string) => void;
  className: string;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const [previewing, setPreviewing] = useState<{ messageId: number; index: number } | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [chat.messages, chat.status]);

  const previewed = previewing
    ? chat.messages.find((message) => message.id === previewing.messageId)?.proposals[previewing.index]
    : undefined;

  // While Flawiusz works, its status shows inside the reply bubble it is writing.
  const workingId = chat.busy ? chat.messages.at(-1)?.id : undefined;

  return (
    <div className={`flawiusz-log ${className}`} ref={logRef} aria-live="polite">
      {chat.messages.map((message) => (
        <div className={`flawiusz-message ${message.role}`} key={message.id}>
          {message.role === "user" ? (
            <p>{message.content}</p>
          ) : (
            <>
              {message.content && <Markdown text={message.content} />}
              {message.projectChoices.length > 0 && (
                <div className="flawiusz-choices">
                  {[...message.projectChoices, { id: null, name: "All my projects" }].map((choice) => (
                    <button
                      // Only the latest question can be answered.
                      disabled={chat.busy || message.id !== chat.messages.at(-1)?.id}
                      key={choice.id ?? "all"}
                      onClick={() => void chat.send(choice.name, choice.id)}
                      type="button"
                    >
                      {choice.name}
                    </button>
                  ))}
                </div>
              )}
              {message.proposals.map((proposal, index) => (
                <ProposalCard
                  key={index}
                  onOpen={() => proposal.savedId && onOpenTemplate(proposal.savedId)}
                  onPreview={() => setPreviewing({ messageId: message.id, index })}
                  onSave={() => void chat.saveProposal(message.id, index)}
                  proposal={proposal}
                />
              ))}
              {message.templates.map((template) => (
                <div className="flawiusz-template" key={template.id}>
                  <span>
                    Saved template <strong>{template.name}</strong>
                  </span>
                  <button type="button" className="secondary-button" onClick={() => onOpenTemplate(template.id)}>
                    Open in Documents
                  </button>
                </div>
              ))}
              {message.error && <p className="flawiusz-error" role="alert">{message.error}</p>}
                {message.id === workingId && (
                  <p className="flawiusz-status">
                    <span className="flawiusz-typing" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    {chat.status}
                  </p>
                )}
            </>
          )}
        </div>
      ))}

      {previewing && previewed && (
        <TemplatePreviewDialog
          initialProjectId={previewed.projectId}
          onClose={() => setPreviewing(null)}
          onSave={() => void chat.saveProposal(previewing.messageId, previewing.index)}
          saved={Boolean(previewed.savedId)}
          saving={Boolean(previewed.saving)}
          template={proposalTemplate(previewed)}
        />
      )}
    </div>
  );
}

function proposalTemplate(proposal: ChatProposal): DocumentTemplate {
  return {
    id: proposal.templateId ?? "proposal",
    name: proposal.name,
    description: proposal.description,
    blocks: proposal.blocks,
    isBuiltIn: false,
    projectId: proposal.projectId,
    showStatus: proposal.showStatus,
    showName: proposal.showName,
  };
}

function ProposalCard({
  proposal,
  onPreview,
  onSave,
  onOpen,
}: {
  proposal: ChatProposal;
  onPreview: () => void;
  onSave: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flawiusz-proposal">
      <div className="flawiusz-proposal-heading">
        <span>{proposal.templateId ? "Proposed changes" : "Template proposal"}</span>
        <strong>{proposal.name}</strong>
        {proposal.description && <p>{proposal.description}</p>}
        <em>For {proposal.projectName ?? "all your projects"}</em>
      </div>
      <ol>
        {proposal.blocks.map((block) => {
          const detail = blockDetail(block);
          return (
            <li key={block.id}>
              <b>{blockLabels[block.type]}</b>
              {detail && <span>{detail}</span>}
            </li>
          );
        })}
      </ol>
      {proposal.error && <p className="flawiusz-error" role="alert">{proposal.error}</p>}
      <div className="flawiusz-proposal-actions">
        {proposal.savedId ? (
          <>
            <span className="flawiusz-proposal-saved">✓ Saved</span>
            <button className="secondary-button" onClick={onOpen} type="button">
              Open in Documents
            </button>
          </>
        ) : (
          <>
            <button className="secondary-button" onClick={onPreview} type="button">
              Preview
            </button>
            <button className="primary-button" disabled={proposal.saving} onClick={onSave} type="button">
              {proposal.saving ? "Saving…" : "Save template"}
            </button>
            <span className="flawiusz-proposal-hint">or tell me what to change</span>
          </>
        )}
      </div>
    </div>
  );
}

export function Composer({
  chat,
  placeholder,
  autoFocus = false,
}: {
  chat: FlawiuszChat;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submit() {
    if (!draft.trim() || chat.busy) return;
    void chat.send(draft);
    setDraft("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className="flawiusz-composer" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        aria-label="Message Flawiusz"
        placeholder={placeholder}
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKey}
      />
      {chat.busy ? (
        <button type="button" className="secondary-button" onClick={chat.stop}>
          Stop
        </button>
      ) : (
        <button type="submit" className="primary-button" disabled={!draft.trim()}>
          Send
        </button>
      )}
    </form>
  );
}

// Launcher and slide-in panel, used on every page except the dashboard.
export function FlawiuszPanel({
  chat,
  open,
  onOpenChange,
  onOpenTemplate,
}: {
  chat: FlawiuszChat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTemplate: (templateId: string) => void;
}) {
  const [hintDismissed, setHintDismissed] = useState(false);
  const showHint = !hintDismissed && chat.messages.length === 0;

  return (
    <>
      {!open && (
        <div className="flawiusz-launcher">
          {showHint && (
            <div className="flawiusz-hint">
              <button type="button" className="flawiusz-hint-body" onClick={() => onOpenChange(true)}>
                Need a hand? <strong>Ask Flawiusz</strong>
              </button>
              <button type="button" className="flawiusz-hint-close" aria-label="Dismiss" onClick={() => setHintDismissed(true)}>
                ×
              </button>
            </div>
          )}
          <button type="button" className="flawiusz-fab" aria-label="Chat with Flawiusz" onClick={() => onOpenChange(true)}>
            <Image src="/flawiusz.png" alt="" width={64} height={64} />
            {chat.busy && <span className="flawiusz-fab-dot" aria-hidden="true" />}
          </button>
        </div>
      )}

      <aside
        className={`flawiusz-panel${open ? " open" : ""}`}
        aria-label="Chat with Flawiusz"
        inert={!open}
        onKeyDown={(event) => event.key === "Escape" && onOpenChange(false)}
      >
        <header className="flawiusz-panel-header">
          <Image src="/flawiusz.png" alt="" width={40} height={40} />
          <div>
            <h2>Flawiusz</h2>
            <p>Your project assistant</p>
          </div>
          {chat.messages.length > 0 && (
            <button type="button" className="flawiusz-icon-button" onClick={chat.reset}>
              New chat
            </button>
          )}
          <button
            type="button"
            className="flawiusz-icon-button close"
            aria-label="Close chat"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </header>

        {chat.messages.length === 0 ? (
          <div className="flawiusz-empty">
            <Image src="/flawiusz.png" alt="" width={72} height={72} />
            <p>
              <strong>Hi, I&apos;m Flawiusz!</strong> I can answer questions about your projects, deadlines and team,
              and draft document templates for you.
            </p>
          </div>
        ) : (
          <ChatLog chat={chat} className="in-panel" onOpenTemplate={onOpenTemplate} />
        )}

        <Composer autoFocus={open} chat={chat} placeholder="Ask Flawiusz…" />
      </aside>
    </>
  );
}
