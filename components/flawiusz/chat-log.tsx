"use client";

import { useEffect, useRef, useState } from "react";
import TemplatePreviewDialog from "@/app/template-preview-dialog";
import { DocumentProposalCard, proposalTemplate } from "./document-proposal-card";
import { Markdown } from "./markdown";
import type { FlawiuszChat } from "./use-flawiusz-chat";
import "./flawiusz.css";

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
                <DocumentProposalCard
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
