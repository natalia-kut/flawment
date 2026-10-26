"use client";

import type { DocumentTemplate } from "@/lib/documents/template-schema";
import { blockDetail, blockLabels } from "./labels";
import type { ChatProposal } from "./use-flawiusz-chat";

export function proposalTemplate(proposal: ChatProposal): DocumentTemplate {
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

export function DocumentProposalCard({
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
