"use client";

import { useEffect, useState, type FormEvent } from "react";

const sectionOptions = [
  { id: "overview", label: "Project overview" },
  { id: "participants", label: "Participants" },
  { id: "tasks", label: "Task summary" },
  { id: "notes", label: "Additional notes" },
] as const;

type SectionId = (typeof sectionOptions)[number]["id"];

type DocumentTemplate = {
  id: string;
  name: string;
  description: string;
  intro: string;
  sections: SectionId[];
  isBuiltIn: boolean;
};

const builtInTemplates: DocumentTemplate[] = [
  {
    id: "participant-list",
    name: "Participant list",
    description: "A contact list for your project team.",
    intro: "Participants working on {{project}}.",
    sections: ["participants"],
    isBuiltIn: true,
  },
  {
    id: "project-card",
    name: "Project card",
    description: "A quick overview of a project's progress and team.",
    intro: "{{project}} — a project overview prepared for your workspace.",
    sections: ["overview", "participants"],
    isBuiltIn: true,
  },
  {
    id: "final-report",
    name: "Final report",
    description: "A project summary with progress, tasks and participants.",
    intro: "Final report for {{project}}. Project progress: {{progress}}%.",
    sections: ["overview", "tasks", "participants", "notes"],
    isBuiltIn: true,
  },
  {
    id: "task-summary",
    name: "Task summary",
    description: "A simple snapshot of project tasks and their owners.",
    intro: "Task summary for {{project}}.",
    sections: ["tasks"],
    isBuiltIn: true,
  },
];

const projects = [
  {
    id: "room-booking",
    name: "Room booking system",
    deadline: "30 November 2026",
    status: "In progress",
    progress: 38,
    description: "Web app for reserving university lecture rooms.",
    participants: [
      { name: "Natalia Kut", role: "Project lead", email: "natalia@example.com" },
      { name: "Alex Morgan", role: "Developer", email: "alex@example.com" },
      { name: "Sam Lee", role: "Designer", email: "sam@example.com" },
    ],
    tasks: [
      { name: "Interview room administrators", owner: "Natalia Kut", status: "Done" },
      { name: "Design booking flow", owner: "Sam Lee", status: "In progress" },
      { name: "Build availability calendar", owner: "Alex Morgan", status: "To do" },
    ],
  },
  {
    id: "student-council",
    name: "Student council website",
    deadline: "15 December 2026",
    status: "In progress",
    progress: 33,
    description: "A new website for student council announcements and events.",
    participants: [
      { name: "Alex Morgan", role: "Project lead", email: "alex@example.com" },
      { name: "Jamie Park", role: "Developer", email: "jamie@example.com" },
    ],
    tasks: [
      { name: "Gather content requirements", owner: "Alex Morgan", status: "Done" },
      { name: "Create home page", owner: "Jamie Park", status: "In progress" },
    ],
  },
  {
    id: "hackathon",
    name: "Hackathon 2027",
    deadline: "10 March 2027",
    status: "Planned",
    progress: 0,
    description: "A student-led weekend hackathon.",
    participants: [
      { name: "Sam Lee", role: "Organizer", email: "sam@example.com" },
      { name: "Jamie Park", role: "Volunteer", email: "jamie@example.com" },
    ],
    tasks: [
      { name: "Book the venue", owner: "Sam Lee", status: "To do" },
      { name: "Publish registration form", owner: "Jamie Park", status: "To do" },
    ],
  },
] as const;

// TODO(auth): Replace the demo namespace with the signed-in user's id.
const storageKey = "flawment:document-templates:demo-user";

function isSectionId(value: unknown): value is SectionId {
  return sectionOptions.some((section) => section.id === value);
}

function isDocumentTemplate(value: unknown): value is DocumentTemplate {
  if (typeof value !== "object" || value === null) return false;

  const template = value as Record<string, unknown>;
  return (
    typeof template.id === "string" &&
    typeof template.name === "string" &&
    typeof template.description === "string" &&
    typeof template.intro === "string" &&
    template.isBuiltIn === false &&
    Array.isArray(template.sections) &&
    template.sections.every(isSectionId)
  );
}

function formatDate() {
  return new Intl.DateTimeFormat("pl-PL").format(new Date());
}

type Project = (typeof projects)[number];

export default function DocumentsView() {
  const [customTemplates, setCustomTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("project-card");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0].id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIntro, setTemplateIntro] = useState("");
  const [selectedSections, setSelectedSections] = useState<SectionId[]>(["overview"]);
  const [storageError, setStorageError] = useState("");
  const [documentDate, setDocumentDate] = useState("");

  useEffect(() => {
    setDocumentDate(formatDate());

    try {
      const savedTemplates = window.localStorage.getItem(storageKey);
      if (!savedTemplates) return;

      const parsed: unknown = JSON.parse(savedTemplates);
      if (!Array.isArray(parsed) || !parsed.every(isDocumentTemplate)) {
        throw new Error("Saved templates have an unexpected format.");
      }
      setCustomTemplates(parsed);
    } catch {
      setStorageError("Saved templates could not be read from this browser.");
    }
  }, []);

  const templates = [...builtInTemplates, ...customTemplates];
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    builtInTemplates[1];
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0];

  function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStorageError("");

    const newTemplate: DocumentTemplate = {
      id: `custom-${Date.now()}`,
      name: templateName.trim(),
      description: templateDescription.trim() || "A template created for your workspace.",
      intro: templateIntro.trim() || "{{project}}",
      sections: selectedSections,
      isBuiltIn: false,
    };

    const updatedTemplates = [...customTemplates, newTemplate];
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updatedTemplates));
      setCustomTemplates(updatedTemplates);
      setSelectedTemplateId(newTemplate.id);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateIntro("");
      setSelectedSections(["overview"]);
      setIsCreateOpen(false);
    } catch {
      setStorageError("Could not save the template in this browser. Check available storage.");
    }
  }

  function toggleSection(sectionId: SectionId) {
    setSelectedSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  function renderSection(sectionId: SectionId, project: Project) {
    switch (sectionId) {
      case "overview":
        return (
          <table className="document-table">
            <tbody>
              <tr><th>Project</th><td>{project.name}</td></tr>
              <tr><th>Deadline</th><td>{project.deadline}</td></tr>
              <tr><th>Status</th><td>{project.status}</td></tr>
              <tr><th>Progress</th><td>{project.progress}%</td></tr>
            </tbody>
          </table>
        );
      case "participants":
        return (
          <table className="document-table">
            <thead>
              <tr><th>Participant</th><th>Project role</th><th>Email</th></tr>
            </thead>
            <tbody>
              {project.participants.map((participant) => (
                <tr key={participant.email}>
                  <td>{participant.name}</td>
                  <td>{participant.role}</td>
                  <td>{participant.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "tasks":
        return (
          <table className="document-table">
            <thead>
              <tr><th>Task</th><th>Assigned to</th><th>Status</th></tr>
            </thead>
            <tbody>
              {project.tasks.map((task) => (
                <tr key={task.name}>
                  <td>{task.name}</td>
                  <td>{task.owner}</td>
                  <td>{task.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "notes":
        return (
          <p className="document-notes">
            This report summarizes the current status of {project.name}. Add
            project decisions and outcomes here when connecting live project data.
          </p>
        );
    }
  }

  function renderIntro(template: DocumentTemplate, project: Project) {
    return template.intro
      .replaceAll("{{project}}", project.name)
      .replaceAll("{{deadline}}", project.deadline)
      .replaceAll("{{status}}", project.status)
      .replaceAll("{{progress}}", String(project.progress));
  }

  return (
    <div className="documents-page">
      <header className="documents-heading">
        <div>
          <p className="eyebrow">WORKSPACE / DOCUMENTATION</p>
          <h1>Documents</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
          <span aria-hidden="true">+</span> New template
        </button>
      </header>

      {storageError && <p className="storage-notice" role="alert">{storageError}</p>}

      <div className="documents-layout">
        <aside className="template-sidebar" aria-label="Document templates">
          <label className="field-label" htmlFor="document-project">Project</label>
          <select
            className="project-select"
            id="document-project"
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>

          <div className="template-list-heading">
            <span>Templates</span>
            <span>{templates.length}</span>
          </div>
          <div className="template-list">
            {templates.map((template) => (
              <button
                className={`template-card${selectedTemplate.id === template.id ? " selected" : ""}`}
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                aria-pressed={selectedTemplate.id === template.id}
              >
                <span className="template-icon" aria-hidden="true">
                  {template.isBuiltIn ? "▤" : "✎"}
                </span>
                <span className="template-card-copy">
                  <strong>{template.name}</strong>
                  <span>{template.isBuiltIn ? "Built-in" : "My template"} · {template.sections.length} sections</span>
                </span>
              </button>
            ))}
          </div>
          <p className="local-storage-note">
            Your templates are saved in this browser for this prototype.
          </p>
        </aside>

        <section className="document-preview-area" aria-label="Document preview">
          <div className="preview-toolbar">
            <div>
              <p className="eyebrow">DOCUMENT PREVIEW</p>
              <h2>{selectedTemplate.name}</h2>
            </div>
            <button className="secondary-button print-button" type="button" onClick={() => window.print()}>
              <span aria-hidden="true">↓</span> Print / save PDF
            </button>
          </div>

          <article className="document-sheet">
            <div className="document-brand">
              <span>FLAWMENT / DOCUMENT</span>
              <span>{documentDate}</span>
            </div>
            <h2>{selectedTemplate.name} · {selectedProject.name}</h2>
            <p className="document-intro">{renderIntro(selectedTemplate, selectedProject)}</p>
            <p className="project-description">{selectedProject.description}</p>
            {selectedTemplate.sections.map((sectionId) => {
              const section = sectionOptions.find((option) => option.id === sectionId);
              return (
                <section className="document-section" key={sectionId}>
                  <h3>{section?.label}</h3>
                  {renderSection(sectionId, selectedProject)}
                </section>
              );
            })}
            <footer className="document-footer">Generated with Flawment</footer>
          </article>
        </section>
      </div>

      {isCreateOpen && (
        <div className="template-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsCreateOpen(false);
        }}>
          <section
            className="template-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-dialog-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h2 id="template-dialog-title">Create a template</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="template-form" onSubmit={handleCreateTemplate}>
              <label className="field-label" htmlFor="template-name">Template name</label>
              <input
                autoFocus
                id="template-name"
                maxLength={60}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="e.g. Weekly project update"
                required
                value={templateName}
              />
              <label className="field-label" htmlFor="template-description">Description</label>
              <input
                id="template-description"
                maxLength={120}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="What is this template for?"
                value={templateDescription}
              />
              <label className="field-label" htmlFor="template-intro">Introduction</label>
              <textarea
                id="template-intro"
                onChange={(event) => setTemplateIntro(event.target.value)}
                placeholder="Use {{project}}, {{deadline}}, {{status}} or {{progress}}"
                rows={3}
                value={templateIntro}
              />
              <fieldset className="section-picker">
                <legend className="field-label">Sections to include</legend>
                {sectionOptions.map((section) => (
                  <label className="section-option" key={section.id}>
                    <input
                      checked={selectedSections.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                      type="checkbox"
                    />
                    {section.label}
                  </label>
                ))}
              </fieldset>
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" disabled={selectedSections.length === 0} type="submit">
                  Save template
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
