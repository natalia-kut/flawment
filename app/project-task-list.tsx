"use client";

import { useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { emptyTaskFilters, filterTasks, taskAssigneeKey, type TaskFilters } from "@/lib/tasks/filters";
import { formatTaskDeadline, taskPriorityLabels, taskStatusLabels } from "@/lib/tasks/labels";
import controls from "@/components/ui/filter-bar.module.css";
import DeleteTaskForm from "./delete-task-form";
import styles from "./project-task-list.module.css";

export default function ProjectTaskList({ project, onCreate, onEdit }: {
  project: WorkspaceProject;
  onCreate: () => void;
  onEdit: (id: number) => void;
}) {
  const [filters, setFilters] = useState<TaskFilters>({ ...emptyTaskFilters });
  const tasks = filterTasks(project.tasks, filters);
  const hasFilters = filters.query.trim() !== "" || !!filters.status || !!filters.priority || !!filters.assignee || !!filters.stage;
  const assignees = Array.from(new Map(project.tasks.map((task) =>
    [taskAssigneeKey(task), task.assigneeName] as const
  ))).filter(([key]) => key !== "unassigned")
    .sort((a, b) => a[1].localeCompare(b[1]));

  function update(key: keyof TaskFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return <section className={"workspace-card " + styles.section} aria-labelledby="project-tasks-heading">
    <div className="section-heading">
      <div>
        <h2 id="project-tasks-heading">Tasks <span className="role-badge">{project.tasks.length}</span></h2>
        <p>Work planned for this project.</p>
      </div>
      {project.canCreateTasks && <button className="primary-button" onClick={onCreate}>+ New task</button>}
    </div>

    {project.tasks.length === 0 ? <p>No tasks yet.</p> : <>
      <div className={controls.toolbar} role="group" aria-label="Task filters">
        <div className={controls.toolbarRow}>
          <input className={controls.search} type="search" aria-label="Search tasks" placeholder="Search tasks by title or description"
            value={filters.query} onChange={(event) => update("query", event.target.value)} />
        </div>
        <div className={controls.toolbarRow}>
          {/* The first option names each filter, so the pills need no labels above them. */}
          <select className={controls.filter} aria-label="Stage" data-active={filters.stage !== ""} value={filters.stage}
            onChange={(event) => update("stage", event.target.value)}>
            <option value="">All stages</option><option value="none">No stage</option>
            {project.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
          <select className={controls.filter} aria-label="Status" data-active={filters.status !== ""} value={filters.status}
            onChange={(event) => update("status", event.target.value)}>
            <option value="">Any status</option>
            {Object.entries(taskStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </select>
          <select className={controls.filter} aria-label="Priority" data-active={filters.priority !== ""} value={filters.priority}
            onChange={(event) => update("priority", event.target.value)}>
            <option value="">Any priority</option>
            {Object.entries(taskPriorityLabels).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}
          </select>
          <select className={controls.filter} aria-label="Assigned to" data-active={filters.assignee !== ""} value={filters.assignee}
            onChange={(event) => update("assignee", event.target.value)}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className={controls.statusRow}>
        <div className={controls.statusText}>
          <p className={controls.status} role="status" aria-live="polite">Showing {tasks.length} of {project.tasks.length} tasks</p>
          {hasFilters && <button type="button" className={controls.clear} onClick={() => setFilters({ ...emptyTaskFilters })}>Clear filters</button>}
        </div>
      </div>

      {tasks.length === 0 ? <div className={styles.empty}>
        <h3>No tasks match your filters</h3>
        <p>Try another search or clear the filters.</p>
      </div> : <ul className={styles.list}>
        {tasks.map((task) => <li key={task.id} className={styles.task}>
          <div className={styles.heading}>
            <div className={styles.titleBlock}>
              <h3>{task.title}</h3>
              <p className={styles.stage}>{task.stageName}</p>
            </div>
            {task.canEdit && <div className={styles.actions}>
              <button className="secondary-button" aria-label={"Edit task: " + task.title}
                onClick={() => onEdit(task.id)}>Edit task</button>
              <DeleteTaskForm projectId={project.id} taskId={task.id} title={task.title} />
            </div>}
          </div>
          {task.description && <p className={styles.description}>{task.description}</p>}
          <dl className={styles.facts}>
            <div><dt>Status</dt><dd><span className={styles.status} data-status={task.status}>{taskStatusLabels[task.status]}</span></dd></div>
            <div><dt>Priority</dt><dd><span className={styles.priority} data-priority={task.priority}>{taskPriorityLabels[task.priority]}</span></dd></div>
            <div><dt>Assigned to</dt><dd>{task.assigneeName}</dd></div>
            <div><dt>Deadline</dt><dd>{formatTaskDeadline(task.deadline)}</dd></div>
          </dl>
        </li>)}
      </ul>}
    </>}
  </section>;
}
