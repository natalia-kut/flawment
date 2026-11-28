"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkspaceProject } from "@/lib/projects/data";
import { formatTaskDeadline, taskPriorityLabels, taskStatusLabels } from "@/lib/tasks/labels";
import { isTaskOverdue } from "@/lib/tasks/board";
import { formatShortDay } from "@/lib/time-off/dates";
import { plainText } from "@/lib/rich-text/markdown";
import EmptyState from "@/components/ui/empty-state";
import DeleteTaskForm from "./delete-task-form";
import styles from "./project-task-list.module.css";

type Task = WorkspaceProject["tasks"][number];


/**
 * A project's tasks as a compact table: open work by deadline, finished work folded
 * underneath. A row opens to edit. Searching and filtering live on the Tasks board, one link away.
 */
export default function ProjectTaskList({ project, today, onCreate, onEdit }: {
  project: WorkspaceProject;
  today: string;
  onCreate: () => void;
  onEdit: (id: number) => void;
}) {
  const tasks = project.tasks;
  const [unfolded, setUnfolded] = useState<Partial<Record<Task["status"], boolean>>>({});
  const open = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED")
    .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  const closed = (["COMPLETED", "CANCELLED"] as const).map((status) => ({ status, tasks: tasks.filter((task) => task.status === status) }))
    .filter((group) => group.tasks.length > 0);
  const row = (task: Task) => {
    const late = isTaskOverdue(task, today);
    const info = <>
      <span className={styles.title}>
        <span className={styles.priority} data-priority={task.priority} title={taskPriorityLabels[task.priority] + " priority"} />
        <span className="visually-hidden">{taskPriorityLabels[task.priority]} priority: </span>{task.title}
      </span>
      <span className={styles.detail}>{[task.stageName, plainText(task.description).replace(/\s+/g, " ")].filter(Boolean).join(" · ")}</span>
    </>;
    return <div key={task.id} className={styles.row} role="row">
      {/* The row opens the editor for whoever may edit the task, and its page for everyone else. */}
      <span role="cell" className={styles.main}>{task.canEdit
        ? <button type="button" className={styles.open} onClick={() => onEdit(task.id)}>{info}</button>
        : <Link href={"/?task=" + task.id} className={styles.open}>{info}</Link>}</span>
      <span role="cell"><span className={styles.status} data-status={task.status}>{taskStatusLabels[task.status]}</span></span>
      {/* A long name is cut short to fit; the whole of it shows on hover. */}
      <span role="cell" className={styles.assignee} data-empty={task.assignedTo === null || undefined} title={task.assigneeName}>{task.assigneeName}</span>
      <span role="cell" className={styles.due} data-late={late || undefined} title={formatTaskDeadline(task.deadline)}>
        {task.deadline ? formatShortDay(task.deadline) : "—"}{late && <span className="visually-hidden"> (overdue)</span>}
      </span>
      <span role="cell">{task.canEdit && <DeleteTaskForm className={styles.delete} projectId={project.id} taskId={task.id} title={task.title} />}</span>
    </div>;
  };
  if (tasks.length === 0) return <EmptyState art="tasks" title="No tasks yet"
    action={project.canCreateTasks && <button className="primary-button" onClick={onCreate}><span aria-hidden="true">+</span> Create the first task</button>}>
    Split the work into tasks, give them to people and follow them on the board.</EmptyState>;
  return <section className={"workspace-card " + styles.section} aria-labelledby="project-tasks-heading">
    <div className="section-heading">
      <div>
        <h2 id="project-tasks-heading">{open.length > 0 ? "Open tasks" : "No open tasks"} {open.length > 0 && <span className="role-badge">{open.length}</span>}</h2>
        <Link className={styles.board} href={`/?view=tasks&in=${project.id}`}>Open on the Tasks board →</Link>
      </div>
      {project.canCreateTasks && <button className="primary-button" onClick={onCreate}><span aria-hidden="true">+</span> New task</button>}
    </div>

    {open.length > 0 && <div className={styles.table} role="table" aria-label="Open tasks">
      <div className={styles.head} role="row">
        <span role="columnheader">Task</span><span role="columnheader">Status</span>
        <span role="columnheader">Assigned to</span><span role="columnheader">Due</span><span role="columnheader"><span className="visually-hidden">Actions</span></span>
      </div>
      {open.map(row)}
    </div>}
    {/* Finished work is folded away, so the list is what is left to do. */}
    {closed.map(({ status, tasks: group }) => {
      const shown = unfolded[status] ?? open.length === 0;
      return <div key={status} className={styles.closed}>
        <button type="button" className={styles.fold} aria-expanded={shown} onClick={() => setUnfolded({ ...unfolded, [status]: !shown })}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          {taskStatusLabels[status]} <span className="role-badge">{group.length}</span>
        </button>
        {shown && <div role="table" aria-label={taskStatusLabels[status] + " tasks"}>{group.map(row)}</div>}
      </div>;
    })}
  </section>;
}
