"use client";

import { useState, useTransition } from "react";
import { copyTemplate, deleteTemplate } from "@/lib/documents/actions";
import { builtIn } from "@/lib/documents/built-in-templates";
import { formatDay } from "@/lib/documents/engine";
import { createBlock, type DocumentTemplate } from "@/lib/documents/template-schema";
import { projectStatusLabels, type DocumentProject } from "@/lib/documents/types";
import DocumentSheet from "./document-sheet";
import TemplateBuilder from "./template-builder";
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

function templateScope(template: DocumentTemplate) {
  if (template.isBuiltIn) return "Built-in";
  return template.projectId === null ? "All my projects" : "This project";
}

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

export default function DocumentsView({ projects, initialTemplates, today }: DocumentsViewProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplates[0]?.id ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? 0);
  // Template the builder starts from; null while the builder is closed.
  const [builderSource, setBuilderSource] = useState<DocumentTemplate | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copyTarget, setCopyTarget] = useState<DocumentProject | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isDeleting, startDeleting] = useTransition();
  const [isCopying, startCopying] = useTransition();

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
    setError("");
    setNotice("");
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

  return (
    <div className="documents-page">
      <header className="documents-heading">
        <div>
          <p className="eyebrow">WORKSPACE / DOCUMENTATION</p>
          <h1>Documents</h1>
          <p className="section-description">
            Generate project documents from live data, or design your own template.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setBuilderSource(blankTemplate)}>
          <span aria-hidden="true">+</span> New template
        </button>
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
            <label className="field-label" htmlFor="document-project">Project</label>
            <select
              className="project-select"
              id="document-project"
              value={selectedProject.id}
              onChange={(event) => {
                setSelectedProjectId(Number(event.target.value));
                setCopyTarget(null);
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <p className="project-meta">
              {projectStatusLabels[selectedProject.status]} · {formatDay(selectedProject.startDate)} –{" "}
              {formatDay(selectedProject.endDate)} · {selectedProject.tasks.length} tasks ·{" "}
              {selectedProject.members.length} members
            </p>

            <div className="template-list-heading">
              <span>Templates</span>
              <span>{projectTemplates.length}</span>
            </div>
            <div className="template-list">
              {projectTemplates.map((template) => (
                <button
                  className={`template-card${selectedTemplate.id === template.id ? " selected" : ""}`}
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template.id)}
                  aria-pressed={selectedTemplate.id === template.id}
                >
                  <span className="template-icon" aria-hidden="true">
                    {template.isBuiltIn ? "▤" : "✎"}
                  </span>
                  <span className="template-card-copy">
                    <strong>{template.name}</strong>
                    <span>{template.description || `${template.blocks.length} blocks`}</span>
                    <em>{templateScope(template)}</em>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="document-preview-area" aria-label="Document preview">
            <div className="preview-toolbar">
              <div>
                <p className="eyebrow">DOCUMENT PREVIEW</p>
                <h2>{selectedTemplate.name}</h2>
              </div>
              <div className="heading-actions">
                {selectedTemplate.isBuiltIn ? (
                  <button className="secondary-button" type="button" onClick={() => setBuilderSource(selectedTemplate)}>
                    Customize a copy
                  </button>
                ) : confirmingDelete ? (
                  <>
                    <button className="secondary-button" type="button" onClick={() => setConfirmingDelete(false)}>
                      Keep
                    </button>
                    <button className="danger-button" disabled={isDeleting} type="button" onClick={handleDelete}>
                      {isDeleting ? "Deleting…" : "Delete template"}
                    </button>
                  </>
                ) : copyTarget ? (
                  <>
                    <button className="secondary-button" disabled={isCopying} type="button" onClick={() => setCopyTarget(null)}>
                      Cancel
                    </button>
                    <button className="primary-button" disabled={isCopying} type="button" onClick={() => handleCopy(copyTarget)}>
                      {isCopying ? "Copying…" : `Copy to ${copyTarget.name}`}
                    </button>
                  </>
                ) : (
                  <>
                    {copyTargets.length > 0 && (
                      <select
                        aria-label="Copy to another project"
                        className="project-select compact"
                        onChange={(event) => {
                          setNotice("");
                          setCopyTarget(copyTargets.find((project) => project.id === Number(event.target.value)) ?? null);
                        }}
                        value=""
                      >
                        <option value="">Copy to project…</option>
                        {copyTargets.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    )}
                    <button className="secondary-button" type="button" onClick={() => setConfirmingDelete(true)}>
                      Delete
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setBuilderSource(selectedTemplate)}>
                      Edit
                    </button>
                  </>
                )}
                <button className="primary-button" type="button" onClick={exportPdf}>
                  <span aria-hidden="true">↓</span> Export PDF
                </button>
              </div>
            </div>

            <DocumentSheet project={selectedProject} template={selectedTemplate} today={today} />
          </section>
        </div>
      )}
    </div>
  );
}
