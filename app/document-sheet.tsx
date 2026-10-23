import { Fragment } from "react";
import {
  buildVariables,
  countByStatus,
  describeTiming,
  formatDay,
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
  taskStatuses,
  taskStatusLabels,
  type DocumentProject,
  type DocumentTask,
} from "@/lib/documents/types";

type SheetProps = {
  template: DocumentTemplate;
  project: DocumentProject;
  today: string;
};

const variableLabels = Object.fromEntries(variableOptions.map((option) => [option.key, option.label]));
const taskColumnLabels = Object.fromEntries(taskColumnOptions.map((option) => [option.key, option.label]));
const memberColumnLabels = Object.fromEntries(memberColumnOptions.map((option) => [option.key, option.label]));

function taskCell(column: TaskColumn, task: DocumentTask, today: string) {
  switch (column) {
    case "title":
      return task.title;
    case "assignee":
      return task.assignee?.name ?? <span className="document-muted">Unassigned</span>;
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
      return task.creator.name;
    case "description":
      return task.description ?? "—";
  }
}

function memberCell(column: MemberColumn, row: MemberRow, project: DocumentProject) {
  switch (column) {
    case "name":
      return row.person.name;
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
            <div className="document-metric" key={key}>
              <strong>{variables[key]}</strong>
              <span>{variableLabels[key]}</span>
            </div>
          ))}
        </div>
      );

    case "statusChart": {
      const counts = countByStatus(project);
      const total = project.tasks.length;
      return (
        <>
          <SectionTitle title={block.title} variables={variables} />
          {total === 0 ? (
            <p className="document-muted">This project has no tasks yet.</p>
          ) : (
            <>
              <div className="status-bar" role="img" aria-label="Task status breakdown">
                {taskStatuses.map((status) =>
                  counts[status] > 0 ? (
                    <span
                      className={`status-segment ${status.toLowerCase()}`}
                      key={status}
                      style={{ flexGrow: counts[status] }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="status-legend">
                {taskStatuses.map((status) => (
                  <li key={status}>
                    <span className={`status-dot ${status.toLowerCase()}`} aria-hidden="true" />
                    {taskStatusLabels[status]} <strong>{counts[status]}</strong>
                    <span className="document-muted">({Math.round((counts[status] / total) * 100)}%)</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      );
    }

    case "taskTable": {
      const tasks = selectTasks(project, today, block.filter, block.sort, block.limit);
      return (
        <>
          <SectionTitle title={block.title} variables={variables} />
          {tasks.length === 0 ? (
            <p className="document-muted">{block.emptyText || "No tasks match this section."}</p>
          ) : (
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
      return <div className="document-page-break" aria-hidden="true"><span>Page break</span></div>;
  }
}

export default function DocumentSheet({ template, project, today }: SheetProps) {
  const variables = buildVariables(project, today);

  return (
    <article className="document-sheet">
      <div className="document-brand">
        <span>FLAWMENT / {template.name.toUpperCase()}</span>
        <span>{formatDay(today)}</span>
      </div>
      <h2>{template.name} · {project.name}</h2>
      {project.description && <p className="project-description">{project.description}</p>}
      {template.blocks.map((block) => (
        <Fragment key={block.id}>
          {block.type === "pageBreak" ? (
            renderBlock(block, project, today, variables)
          ) : (
            <section className={`document-section block-${block.type}`}>
              {renderBlock(block, project, today, variables)}
            </section>
          )}
        </Fragment>
      ))}
      <footer className="document-footer">
        <span>Generated with Flawment from live project data</span>
        <span>{project.owner.name} · {project.owner.email}</span>
      </footer>
    </article>
  );
}
