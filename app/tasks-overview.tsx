"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { emptyTaskFilters, taskAssigneeKey, type TaskFilters } from "@/lib/tasks/filters";
import { getOverviewTasks, filterOverviewTasks } from "@/lib/tasks/overview";
import styles from "./project-task-list.module.css";

export default function TasksOverview({ projects }: { projects: WorkspaceProject[] }) {
  const [filters, setFilters] = useState<TaskFilters>({ ...emptyTaskFilters });
  const [projectId, setProjectId] = useState("");
  const allTasks = getOverviewTasks(projects);
  const tasks = filterOverviewTasks(allTasks, filters, projectId);
  const hasFilters = !!projectId || !!filters.query.trim() || !!filters.status || !!filters.priority || !!filters.assignee;
  const assignees = Array.from(new Map(allTasks.map((task) =>
    [taskAssigneeKey(task), task.assigneeName] as const
  ))).filter(([key]) => key !== "unassigned").sort((a, b) => a[1].localeCompare(b[1]));
  function update(key: keyof TaskFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  return <div className="projects-workspace">
    <header className="page-header">
      <h1>Tasks</h1>
      <p>Work across all projects you can access. Open a project to create or manage its tasks.</p>
    </header>
    {allTasks.length === 0 ? <section className="workspace-card">
      <h2>No tasks yet</h2>
      <p>Open a project to view or create tasks according to your project role.</p>
      <Link className="secondary-button" href="/">Open projects</Link>
    </section> : <section className={"workspace-card " + styles.section} aria-label="Workspace tasks">
      <div className={styles.filters} role="group" aria-label="Task filters">
        <label className={styles.search}>Search tasks
          <input type="search" placeholder="Search title or description" value={filters.query} onChange={(e) => update("query", e.target.value)} />
        </label>
        <label>Project<select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select></label>
        <label>Status<select value={filters.status} onChange={(e) => update("status", e.target.value)}>
          <option value="">All statuses</option>
          {["TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
        </select></label>
        <label>Priority<select value={filters.priority} onChange={(e) => update("priority", e.target.value)}>
          <option value="">All priorities</option>
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select></label>
        <label>Assigned to<select value={filters.assignee} onChange={(e) => update("assignee", e.target.value)}>
          <option value="">Anyone</option><option value="unassigned">Unassigned</option>
          {assignees.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <button className="secondary-button" disabled={!hasFilters} onClick={() => {
          setFilters({ ...emptyTaskFilters }); setProjectId("");
        }}>Clear filters</button>
      </div>
      <p className={styles.results} role="status" aria-live="polite">Showing {tasks.length} of {allTasks.length} tasks</p>
      {tasks.length === 0 ? <div className={styles.empty}>
        <h2>No tasks match your filters</h2><p>Try another search or clear the filters.</p>
      </div> : <ul className={styles.list}>
        {tasks.map((task) => <li key={task.id} className={styles.task}>
          <div className={styles.heading}>
            <h3>{task.title}</h3>
            <Link className="secondary-button" href={ "/?project=" + task.projectId }
              aria-label={"Open project: " + task.projectName}>Open project</Link>
          </div>
          <p>Project: {task.projectName}</p>
          {task.description && <p className={styles.description}>{task.description}</p>}
          <dl className={styles.facts}>
            <div><dt>Status</dt><dd>{task.status.replaceAll("_", " ")}</dd></div>
            <div><dt>Priority</dt><dd>{task.priority}</dd></div>
            <div><dt>Assigned to</dt><dd>{task.assigneeName}</dd></div>
            <div><dt>Deadline</dt><dd>{task.deadline || "No deadline"}</dd></div>
          </dl>
        </li>)}
      </ul>}
    </section>}
  </div>;
}
