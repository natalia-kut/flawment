import type { HTMLAttributes, ReactNode } from "react";
import {
  buildVariables,
  describeTiming,
  formatDay,
  healthTone,
  initials,
  interpolate,
  isOverdue,
  roleLabel,
  selectMembers,
  selectTasks,
  type MemberRow,
} from "@/lib/documents/engine";
import {
  memberColumnOptions,
  taskColumnOptions,
  variableOptions,
  type DocumentTemplate,
  type MemberColumn,
  type TaskColumn,
  type TemplateBlock,
} from "@/lib/documents/template-schema";
import {
  taskPriorityLabels,
  taskStatusLabels,
  type DocumentPerson,
  type DocumentProject,
  type DocumentTask,
} from "@/lib/documents/types";
import DocumentChart from "./document-charts";

export type BlockFrame = HTMLAttributes<HTMLElement> & { controls?: ReactNode };

type SheetProps = {
  template: DocumentTemplate;
  project: DocumentProject;
  today: string;
  frame?: (block: TemplateBlock, index: number) => BlockFrame;
};

const variableLabels = Object.fromEntries(variableOptions.map((option) => [option.key, option.label]));
const taskColumnLabels = Object.fromEntries(taskColumnOptions.map((option) => [option.key, option.label]));
const memberColumnLabels = Object.fromEntries(memberColumnOptions.map((option) => [option.key, option.label]));

function Person({ person }: { person: Pick<DocumentPerson, "name"> }) {
  return (
    <span className="person">
      <span className="person-initials" aria-hidden="true">{initials(person.name)}</span>
      {person.name}
    </span>
  );
}

// Figures that signal a problem get a warning tone when they are above zero.
const alertMetrics = new Set(["overdueTasks", "unassignedTasks", "highPriorityOpen"]);

function metricTone(key: string, value: string) {
  if (key === "scheduleHealth") return healthTone(value);
  if (key === "overdueTasks") return value !== "0" ? "critical" : "good";
  if (alertMetrics.has(key)) return value !== "0" ? "warning" : "good";
  return "neutral";
}

function taskCell(column: TaskColumn, task: DocumentTask, today: string) {
  switch (column) {
    case "title":
      return task.title;
    case "assignee":
      return task.assignee ? <Person person={task.assignee} /> : <span className="document-muted">Unassigned</span>;
    case "status":
      return taskStatusLabels[task.status];
    case "priority":
      return <span className={`priority-tag ${task.priority.toLowerCase()}`}>{taskPriorityLabels[task.priority]}</span>;
    case "deadline":
      return formatDay(task.deadline);
    case "timing":
      return (
        <span className={isOverdue(task, today) ? "document-late" : undefined}>{describeTiming(task, today)}</span>
      );
    case "creator":
      return <Person person={task.creator} />;
    case "description":
      return task.description ?? "—";
  }
}

function memberCell(column: MemberColumn, row: MemberRow, project: DocumentProject) {
  switch (column) {
    case "name":
      return <Person person={row.person} />;
    case "email":
      return row.person.email;
    case "role":
      return roleLabel(project, row);
    case "joined":
      return formatDay(row.joinedAt);
    case "open":
      return row.open;
    case "completed":
      return row.completed;
    case "overdue":
      return row.overdue > 0 ? <span className="document-late">{row.overdue}</span> : 0;
    case "highPriority":
      return row.highPriority;
  }
}

function signersFor(project: DocumentProject, signers: Extract<TemplateBlock, { type: "signatures" }>["signers"]) {
  const owner = { name: project.owner.name, role: "Project owner" };
  const others = project.members.filter((member) => member.person.id !== project.owner.id);

  if (signers === "owner") return [owner];
  const extra = signers === "allMembers" ? others : others.filter((member) => member.role === "MANAGER");
  return [owner, ...extra.map((member) => ({ name: member.person.name, role: roleLabel(project, member) }))];
}

function SectionTitle({ title, variables }: { title: string; variables: Record<string, string> }) {
  return title.trim() ? <h3>{interpolate(title, variables)}</h3> : null;
}

function renderBlock(block: TemplateBlock, project: DocumentProject, today: string, variables: Record<string, string>) {
  switch (block.type) {
    case "heading":
      return <h3 className="document-heading">{interpolate(block.text, variables)}</h3>;

    case "text":
      return interpolate(block.text, variables)
        .split(/\n+/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph, index) => (
          <p className="document-text" key={index}>{paragraph}</p>
        ));

    case "facts":
      return (
        <>
          <SectionTitle title={block.title} variables={variables} />
          <table className="document-table">
            <tbody>
              {block.facts.map((key) => (
                <tr key={key}>
                  <th>{variableLabels[key]}</th>
                  <td>{variables[key] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );

    case "metrics":
      return (
        <div className="document-metrics">
          {block.metrics.map((key) => (
            <div className={`document-metric tone-${metricTone(key, variables[key])}`} key={key}>
              <strong>{variables[key]}</strong>
              <span>{variableLabels[key]}</span>
            </div>
          ))}
        </div>
      );

    case "chart":
      return (
        <>
          <SectionTitle title={block.title} variables={variables} />
          <DocumentChart kind={block.kind} project={project} today={today} />
        </>
      );

    case "taskTable": {
      const tasks = selectTasks(project, today, block.filter, block.sort, block.limit);
      return (
        <>
          <SectionTitle title={block.title} variables={variables} />
          {tasks.length === 0 ? (
            <p className="document-muted">{block.emptyText || "No tasks match this section."}</p>
          ) : (
            <div className="table-scroll">
              <table className="document-table">
                <thead>
                  <tr>
                    {block.columns.map((column) => (
                      <th className={`column-${column}`} key={column}>{taskColumnLabels[column]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      {block.columns.map((column) => (
                        <td className={`column-${column}`} key={column}>{taskCell(column, task, today)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      );
    }

    case "memberTable": {
      const rows = selectMembers(project, today, block.sort);
      return (
        <>
          <SectionTitle title={block.title} variables={variables} />
          {rows.length === 0 ? (
            <p className="document-muted">This project has no members yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="document-table">
                <thead>
                  <tr>
                    {block.columns.map((column) => (
                      <th className={`column-${column}`} key={column}>{memberColumnLabels[column]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.person.id}>
                      {block.columns.map((column) => (
                        <td className={`column-${column}`} key={column}>{memberCell(column, row, project)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      );
    }

    case "signatures":
      return (
        <>
          <SectionTitle title={block.title} variables={variables} />
          <div className="signature-grid">
            {signersFor(project, block.signers).map((signer) => (
              <div className="signature" key={signer.name}>
                <span className="signature-line" />
                <strong>{signer.name}</strong>
                <span>{signer.role} · date</span>
              </div>
            ))}
          </div>
        </>
      );

    case "pageBreak":
      return <span aria-hidden="true">Page break</span>;
  }
}

export default function DocumentSheet({ template, project, today, frame }: SheetProps) {
  const variables = buildVariables(project, today);
  const tone = healthTone(variables.scheduleHealth);

  return (
    <article className="document-sheet">
      <header className="document-cover">
        <div className="document-cover-top">
          <span>flawment<b>.</b></span>
          {template.showName && <span>{template.name}</span>}
        </div>
        <h2>{project.name}</h2>
        {project.description && <p>{project.description}</p>}
        {template.showStatus && (
          <span className={`health-pill tone-${tone}`}>
            <span aria-hidden="true">{tone === "good" ? "✓" : tone === "neutral" ? "•" : "!"}</span>
            {variables.scheduleHealth}
          </span>
        )}
      </header>
      <dl className="document-meta">
        <div><dt>Owner</dt><dd>{project.owner.name}</dd></div>
        <div><dt>Period</dt><dd>{formatDay(project.startDate)} – {formatDay(project.endDate)}</dd></div>
        <div><dt>Team</dt><dd>{variables.memberCount}</dd></div>
        <div><dt>Generated</dt><dd>{formatDay(today)}</dd></div>
      </dl>
      {template.blocks.map((block, index) => {
        const { className, controls, ...props } = frame?.(block, index) ?? {};
        const Element = block.type === "pageBreak" ? "div" : "section";
        const baseClass = block.type === "pageBreak" ? "document-page-break" : `document-section block-${block.type}`;
        return (
          <Element key={block.id} {...props} className={className ? `${baseClass} ${className}` : baseClass}>
            {renderBlock(block, project, today, variables)}
            {controls}
          </Element>
        );
      })}
      <footer className="document-footer">
        <span>{template.showName ? `${template.name} · generated with Flawment` : "Generated with Flawment"}</span>
        <span>{project.owner.name} · {project.owner.email}</span>
      </footer>
    </article>
  );
}
