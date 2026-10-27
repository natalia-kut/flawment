"use client";

import { useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { emptyTaskFilters, filterTasks, taskAssigneeKey, type TaskFilters } from "@/lib/tasks/filters";
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
      {project.canManageTasks && <button className="primary-button" onClick={onCreate}>+ New task</button>}
    </div>

    {project.tasks.length === 0 ? <p>No tasks yet.</p> : <>
      <div className={styles.filters} role="group" aria-label="Task filters">
        <label className={styles.search}>Search tasks
          <input type="search" placeholder="Search title or description" value={filters.query}
            onChange={(event) => update("query", event.target.value)} />
        </label>
        <label>Stage<select value={filters.stage} onChange={(event) => update("stage", event.target.value)}>
          <option value="">All stages</option><option value="none">No stage</option>
          {project.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </select></label>
        <label>Status
          <select value={filters.status} onChange={(event) => update("status", event.target.value)}>
            <option value="">All statuses</option>
            {["TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"].map((status) =>
              <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label>Priority
          <select value={filters.priority} onChange={(event) => update("priority", event.target.value)}>
            <option value="">All priorities</option>
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) =>
              <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <label>Assigned to
          <select value={filters.assignee} onChange={(event) => update("assignee", event.target.value)}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
        </label>
        <button className="secondary-button" disabled={!hasFilters}
          onClick={() => setFilters({ ...emptyTaskFilters })}>Clear filters</button>
      </div>

      <p className={styles.results} role="status" aria-live="polite">
        Showing {tasks.length} of {project.tasks.length} tasks
      </p>
      {tasks.length === 0 ? <div className={styles.empty}>
        <h3>No tasks match your filters</h3>
        <p>Try another search or clear the filters.</p>
      </div> : <ul className={styles.list}>
        {tasks.map((task) => <li key={task.id} className={styles.task}>
          <div className={styles.heading}>
            <h3>{task.title}</h3>
            {project.canManageTasks && <div className={styles.actions}>
              <button className="secondary-button" aria-label={"Edit task: " + task.title}
                onClick={() => onEdit(task.id)}>Edit task</button>
              <DeleteTaskForm projectId={project.id} taskId={task.id} title={task.title} />
            </div>}
          </div>
          <p>Stage: {task.stageName}</p>
          {task.description && <p className={styles.description}>{task.description}</p>}
          <dl className={styles.facts}>
            <div><dt>Status</dt><dd>{task.status.replaceAll("_", " ")}</dd></div>
            <div><dt>Priority</dt><dd>{task.priority}</dd></div>
            <div><dt>Assigned to</dt><dd>{task.assigneeName}</dd></div>
            <div><dt>Deadline</dt><dd>{task.deadline || "No deadline"}</dd></div>
          </dl>
        </li>)}
      </ul>}
    </>}
  </section>;
}
