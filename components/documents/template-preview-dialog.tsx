"use client";

import { useEffect, useRef, useState } from "react";
import { getPreviewData } from "@/lib/documents/actions";
import type { DocumentTemplate } from "@/lib/documents/template-schema";
import type { DocumentProject } from "@/lib/documents/types";
import DocumentSheet from "./document-sheet";
import "./documents.css";

// A template rendered with one of the user's projects, before it is saved.
export default function TemplatePreviewDialog({
  template,
  initialProjectId,
  saved,
  saving,
  onSave,
  onClose,
}: {
  template: DocumentTemplate;
  initialProjectId: number | null;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<{ projects: DocumentProject[]; today: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [projectId, setProjectId] = useState(initialProjectId);

  useEffect(() => {
    const dialog = ref.current!;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    getPreviewData().then(setData, () => setFailed(true));
  }, []);

  const project = data?.projects.find((item) => item.id === projectId) ?? data?.projects[0];

  return (
    <dialog
      aria-label={`Preview of ${template.name}`}
      className="template-preview-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={ref}
    >
      <header className="template-preview-header">
        <div>
          <h2>{template.name}</h2>
          <p>Preview with live project data</p>
        </div>
        {data && data.projects.length > 1 && project && (
          <select
            aria-label="Preview with project"
            className="project-select compact"
            onChange={(event) => setProjectId(Number(event.target.value))}
            value={project.id}
          >
            {data.projects.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        )}
      </header>

      <div className="template-preview-body documents-page">
        {failed ? (
          <p className="template-preview-note">The preview could not be loaded. Try again.</p>
        ) : !data ? (
          <p className="template-preview-note">Loading the preview…</p>
        ) : !project ? (
          <p className="template-preview-note">Create a project to see a preview.</p>
        ) : (
          <DocumentSheet project={project} template={template} today={data.today} />
        )}
      </div>

      <footer className="template-preview-footer">
        <button className="secondary-button" onClick={onClose} type="button">
          Close
        </button>
        {!saved && (
          <button className="primary-button" disabled={saving} onClick={onSave} type="button">
            {saving ? "Saving…" : "Save template"}
          </button>
        )}
      </footer>
    </dialog>
  );
}
