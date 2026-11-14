"use client";

import Link from "next/link";
import type { WorkspaceProject } from "@/lib/projects/data";
import { formatTaskDeadline, taskPriorityLabels, taskStatusLabels } from "@/lib/tasks/labels";
import { isTaskOverdue } from "@/lib/tasks/board";
import DeleteTaskForm from "./delete-task-form";
import styles from "./project-task-list.module.css";

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * A project's tasks as a compact table: one row each, opened to edit. Searching and
 * filtering live on the Tasks board, one link away.
 */
export default function ProjectTaskList({ project, today, onCreate, onEdit }: {
  project: WorkspaceProject;
  today: string;
  onCreate: () => void;
  onEdit: (id: number) => void;
}) {
  const tasks = project.tasks;
  return <section className={"workspace-card " + styles.section} aria-labelledby="project-tasks-heading">
    <div className="section-heading">
      <div>
        <h2 id="project-tasks-heading">Tasks <span className="role-badge">{tasks.length}</span></h2>
        {tasks.length > 0 && <Link className={styles.board} href={`/?view=tasks&in=${project.id}`}>Open on the Tasks board →</Link>}
      </div>
      {project.canCreateTasks && <button className="primary-button" onClick={onCreate}>+ New task</button>}
    </div>

    {tasks.length === 0 ? <p>No tasks yet.</p> : <>
      <div className={styles.table} role="table" aria-label="Tasks">
        <div className={styles.head} role="row">
          <span role="columnheader">Task</span><span role="columnheader">Status</span>
          <span role="columnheader">Assigned to</span><span role="columnheader">Due</span><span role="columnheader"><span className="visually-hidden">Actions</span></span>
        </div>
        {tasks.map((task) => {
          const late = isTaskOverdue(task, today);
          const info = <>
            <span className={styles.title}>
              <span className={styles.priority} data-priority={task.priority} title={taskPriorityLabels[task.priority] + " priority"} />
              <span className="visually-hidden">{taskPriorityLabels[task.priority]} priority: </span>{task.title}
            </span>
            <span className={styles.detail}>{[task.stageName, task.description].filter(Boolean).join(" · ")}</span>
          </>;
          return <div key={task.id} className={styles.row} role="row">
            {/* The row opens the task, for whoever may edit it. */}
            <span role="cell" className={styles.main}>{task.canEdit
              ? <button type="button" className={styles.open} aria-label={"Edit task: " + task.title} onClick={() => onEdit(task.id)}>{info}</button>
              : info}</span>
            <span role="cell"><span className={styles.status} data-status={task.status}>{taskStatusLabels[task.status]}</span></span>
            <span role="cell" className={styles.assignee} data-empty={task.assignedTo === null || undefined}>{task.assigneeName}</span>
            <span role="cell" className={styles.due} data-late={late || undefined} title={formatTaskDeadline(task.deadline)}>
              {task.deadline ? shortDate.format(new Date(task.deadline + "T00:00:00Z")) : "—"}{late && <span className="visually-hidden"> (overdue)</span>}
            </span>
            <span role="cell">{task.canEdit && <DeleteTaskForm className={styles.delete} projectId={project.id} taskId={task.id} title={task.title} />}</span>
          </div>;
        })}
      </div>
    </>}
  </section>;
}
