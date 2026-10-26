"use client";

import { useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { copyTemplate, deleteTemplate, saveTemplate } from "@/lib/documents/actions";
import { builtIn } from "@/lib/documents/built-in-templates";
import { createBlock, templateLimits, type DocumentTemplate } from "@/lib/documents/template-schema";
import type { DocumentProject } from "@/lib/documents/types";
import DocumentSheet from "./document-sheet";
import TemplateBuilder from "./template-builder";
import { RequestedTemplateContext } from "./workspace-context";
import "./documents.css";

type DocumentsViewProps = {
  projects: DocumentProject[];
  initialTemplates: DocumentTemplate[];
  today: string;
};

const blankTemplate: DocumentTemplate = {
  id: "blank",
  name: "",
  description: "",
  blocks: [createBlock("heading"), createBlock("text")],
  ...builtIn,
};


function fileName(...parts: string[]) {
  return parts.join(" - ").replace(/[\\/:*?"<>|]+/g, "").trim();
}

// The browser's print dialog saves the sheet as a vector PDF; the title becomes the file name.
function printAs(title: string) {
  const previousTitle = document.title;
  document.title = title;
  window.addEventListener("afterprint", () => (document.title = previousTitle), { once: true });
  window.print();
}

function ConfirmDialog({ tone, title, children, confirmLabel, busyLabel, busy, onConfirm, onClose }: {
  tone: "danger" | "accent";
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
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

  return (
    <dialog
      aria-describedby="confirm-dialog-text"
      aria-labelledby="confirm-dialog-title"
      className={`confirm-dialog ${tone}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      ref={ref}
    >
      <span aria-hidden="true" className="confirm-dialog-icon">
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d={tone === "danger" ? "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" : "M8 8h11v11H8zM5 16V5h11"} />
        </svg>
      </span>
      <h2 id="confirm-dialog-title">{title}</h2>
      <p id="confirm-dialog-text">{children}</p>
      <div className="confirm-dialog-actions">
        <button className="secondary-button" disabled={busy} onClick={onClose} type="button">
          Cancel
        </button>
        <button className={tone === "danger" ? "danger-button" : "primary-button"} disabled={busy} onClick={onConfirm} type="button">
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export default function DocumentsView({ projects, initialTemplates, today }: DocumentsViewProps) {
  const requestedTemplateId = useContext(RequestedTemplateContext);
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initialTemplates.some((template) => template.id === requestedTemplateId)
      ? requestedTemplateId!
      : (initialTemplates[0]?.id ?? ""),
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialTemplates.find((template) => template.id === requestedTemplateId)?.projectId ?? projects[0]?.id ?? 0,
  );
  // Template the builder starts from; null while the builder is closed.
  const [builderSource, setBuilderSource] = useState<DocumentTemplate | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copyTarget, setCopyTarget] = useState<DocumentProject | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isDeleting, startDeleting] = useTransition();
  const [isCopying, startCopying] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [, startRenaming] = useTransition();

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  // Custom templates show up only in their own project, or everywhere when they have none.
  const projectTemplates = templates.filter(
    (template) => template.isBuiltIn || template.projectId === null || template.projectId === selectedProject?.id,
  );
  const selectedTemplate = projectTemplates.find((template) => template.id === selectedTemplateId) ?? projectTemplates[0];
  const copyTargets = projects.filter((project) => project.id !== selectedTemplate.projectId);

  function selectTemplate(id: string) {
    setSelectedTemplateId(id);
    setConfirmingDelete(false);
    setCopyTarget(null);
    setRenaming(false);
    setError("");
    setNotice("");
  }

  function rename(value: string) {
    setRenaming(false);
    const template = selectedTemplate;
    const name = value.trim();
    if (!name || name === template.name) return;

    // Show the new name right away and put the old one back if saving fails.
    const replace = (next: DocumentTemplate) =>
      setTemplates((current) => current.map((item) => (item.id === template.id ? next : item)));
    replace({ ...template, name });
    setError("");
    startRenaming(async () => {
      const result = await saveTemplate(template.id, { ...template, name });
      if (result.ok) replace(result.value);
      else {
        replace(template);
        setError(result.error);
      }
    });
  }

  function handleCopy(target: DocumentProject) {
    const id = selectedTemplate.id;
    setError("");
    setNotice("");
    startCopying(async () => {
      const result = await copyTemplate(id, target.id);
      setCopyTarget(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTemplates((current) => [...current, result.value]);
      setNotice(`Copied to ${target.name}.`);
    });
  }

  function handleSaved(saved: DocumentTemplate) {
    setTemplates((current) =>
      current.some((template) => template.id === saved.id)
        ? current.map((template) => (template.id === saved.id ? saved : template))
        : [...current, saved],
    );
    selectTemplate(saved.id);
    setBuilderSource(null);
  }

  function handleDelete() {
    const id = selectedTemplate.id;
    startDeleting(async () => {
      const result = await deleteTemplate(id);
      if (!result.ok) {
        setConfirmingDelete(false);
        setError(result.error);
        return;
      }
      setTemplates((current) => current.filter((template) => template.id !== id));
      selectTemplate(templates[0].id);
    });
  }

  function exportPdf() {
    printAs(fileName(selectedTemplate.name, selectedProject.name, today));
  }

  if (builderSource) {
    return (
      <div className="documents-page">
        <TemplateBuilder
          onCancel={() => setBuilderSource(null)}
          onProjectChange={setSelectedProjectId}
          onSaved={handleSaved}
          projectId={selectedProjectId}
          projects={projects}
          source={builderSource}
          today={today}
        />
      </div>
    );
  }

  function templateCard(template: DocumentTemplate) {
    const selected = selectedTemplate.id === template.id;
    return (
      <button
        aria-pressed={selected}
        className={`template-card${selected ? " selected" : ""}`}
        key={template.id}
        onClick={() => selectTemplate(template.id)}
        type="button"
      >
        <strong title={template.name}>{template.name}</strong>
        <span>{template.description || `${template.blocks.length} blocks`}</span>
        {!template.isBuiltIn && template.projectId === null && <em>All projects</em>}
      </button>
    );
  }

  const customTemplates = projectTemplates.filter((template) => !template.isBuiltIn);

  return (
    <div className="documents-page">
      <header className="documents-heading">
        <div>
          <h1>Documents</h1>
          <p className="section-description">Create reports from your project&apos;s tasks, deadlines and team.</p>
        </div>
      </header>

      {error && <p className="storage-notice" role="alert">{error}</p>}
      {notice && <p className="storage-notice success" role="status">{notice}</p>}

      {!selectedProject ? (
        <section className="placeholder-panel">
          <div className="placeholder-mark" aria-hidden="true">D</div>
          <h2>No projects yet</h2>
          <p>Documents are generated from project data. Create a project to get started.</p>
        </section>
      ) : (
        <div className="documents-layout">
          <aside className="template-sidebar" aria-label="Document templates">
            <label className="template-list-heading" htmlFor="document-project">Project</label>
            <select
              className="project-select"
              id="document-project"
              onChange={(event) => {
                setSelectedProjectId(Number(event.target.value));
                setCopyTarget(null);
              }}
              value={selectedProject.id}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>

            <p className="template-list-heading">Built-in</p>
            <div className="template-list">
              {projectTemplates.filter((template) => template.isBuiltIn).map(templateCard)}
            </div>

            <p className="template-list-heading">Your templates</p>
            <div className="template-list">
              {customTemplates.map(templateCard)}
              <button className="new-template-button" onClick={() => setBuilderSource(blankTemplate)} type="button">
                <span aria-hidden="true">+</span> New template
              </button>
            </div>
          </aside>

          <section className="document-preview-area" aria-label="Document preview">
            <div className="preview-toolbar">
              {renaming ? (
                <h2>
                  <input
                    aria-label="Template name"
                    autoFocus
                    className="template-title-input"
                    defaultValue={selectedTemplate.name}
                    maxLength={templateLimits.name}
                    onBlur={(event) => rename(event.target.value)}
                    onFocus={(event) => event.target.select()}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") event.currentTarget.value = selectedTemplate.name;
                      if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                    }}
                  />
                </h2>
              ) : selectedTemplate.isBuiltIn ? (
                <h2>{selectedTemplate.name}</h2>
              ) : (
                <h2>
                  <button className="template-title" onClick={() => setRenaming(true)} title="Rename" type="button">
                    {selectedTemplate.name}
                    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 16 16">
                      <path d="M10.5 3.5l2 2L6 12H4v-2zM9 5l2 2" />
                    </svg>
                  </button>
                </h2>
              )}
              <div className="heading-actions">
                {!selectedTemplate.isBuiltIn && copyTargets.length > 0 && (
                  <details className="copy-menu" key={`copy-${selectedTemplate.id}`}>
                    <summary>Copy to project</summary>
                    <div className="copy-menu-list">
                      {copyTargets.map((project) => (
                        <button
                          key={project.id}
                          onClick={(event) => {
                            event.currentTarget.closest("details")?.removeAttribute("open");
                            setNotice("");
                            setCopyTarget(project);
                          }}
                          type="button"
                        >
                          {project.name}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                {!selectedTemplate.isBuiltIn && (
                  <button className="secondary-button" type="button" onClick={() => setConfirmingDelete(true)}>
                    Delete
                  </button>
                )}
                <button className="secondary-button" type="button" onClick={() => setBuilderSource(selectedTemplate)}>
                  {selectedTemplate.isBuiltIn ? "Customize a copy" : "Edit"}
                </button>
                <button className="primary-button" type="button" onClick={exportPdf}>
                  <span aria-hidden="true">↓</span> Export PDF
                </button>
              </div>
            </div>

            <DocumentSheet project={selectedProject} template={selectedTemplate} today={today} />
          </section>
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          busy={isDeleting}
          busyLabel="Deleting…"
          confirmLabel="Delete"
          onClose={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
          title="Delete this template?"
          tone="danger"
        >
          <strong>{selectedTemplate.name}</strong> will be removed for good. PDFs you already exported are not affected.
        </ConfirmDialog>
      )}

      {copyTarget && (
        <ConfirmDialog
          busy={isCopying}
          busyLabel="Copying…"
          confirmLabel="Copy template"
          onClose={() => setCopyTarget(null)}
          onConfirm={() => handleCopy(copyTarget)}
          title="Copy to another project?"
          tone="accent"
        >
          A copy of <strong>{selectedTemplate.name}</strong> will be added to <strong>{copyTarget.name}</strong>. Editing one
          later does not change the other.
        </ConfirmDialog>
      )}
    </div>
  );
}
