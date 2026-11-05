"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { filterProjects } from "@/lib/projects/filters";
import { taskProgress, isTaskOverdue } from "@/lib/tasks/board";
import styles from "./project-browser.module.css";

export default function ProjectBrowser({ projects, today }: { projects: WorkspaceProject[]; today: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const labels: Record<string, string> = { TO_DO: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", ARCHIVED: "Archived", CANCELLED: "Cancelled" };
  const results = filterProjects(projects, { query, status, showArchived });
  return <>
    <div className={styles.controls}>
      <label className={styles.check}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Show archived</label>
      <button className={styles.filterButton} aria-expanded={filtersOpen} aria-controls="project-filters" onClick={() => setFiltersOpen(!filtersOpen)}>Filters{query || status ? " · Active" : ""}</button>
    </div>
    {filtersOpen && <div id="project-filters" className={styles.filters} role="group" aria-label="Project filters">
      <label className={styles.search}>Search projects
        <input type="search" placeholder="Search name or description" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {["TO_DO", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"].map((value) =>
          <option key={value} value={value}>{labels[value]}</option>)}
      </select></label>
      <button className="secondary-button" disabled={!query && !status && !showArchived}
        onClick={() => { setQuery(""); setStatus(""); setShowArchived(false); }}>Clear filters</button>
    </div>}
    <p role="status" aria-live="polite" className={query || status ? styles.results : styles.caption}>Showing {results.length} of {projects.length} projects</p>
    {results.length === 0 ? <section className="project-empty-state">
      <h2>No projects match your filters</h2><p>Try another search or clear the filters.</p>
    </section> : <div className={styles.tableWrap}><table className={styles.table}>
      <caption className={styles.caption}>Projects you can access</caption>
      <thead><tr><th scope="col">Name</th><th scope="col">Deadline</th><th scope="col">Status</th>
        <th scope="col">Progress</th><th scope="col">People</th></tr></thead>
      <tbody>{results.map((project) => {
        const progress = taskProgress(project.tasks);
        const overdue = project.tasks.filter((task) => isTaskOverdue(task, today)).length;
        const ongoing = project.tasks.filter((task) => task.status === "IN_PROGRESS" || task.status === "IN_REVIEW").length;
        return <tr key={project.id}>
          <th scope="row"><Link href={"/?project=" + project.id}>{project.name}</Link>
            {overdue > 0 && <p className={styles.overdue}>{overdue} overdue {overdue === 1 ? "task" : "tasks"}</p>}</th>
          <td>{project.end_date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(project.end_date + "T00:00:00Z")) : "No deadline"}</td>
          <td><span className={styles.status} data-status={project.status}>{labels[project.status]}</span></td>
          <td><div className={styles.progress}>
            <div className={styles.track} role="progressbar" aria-label={project.name + " task completion"} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
              <span className={styles.done} style={{ width: progress.percent + "%" }} />
              <span className={styles.ongoing} style={{ width: (progress.total ? ongoing / progress.total * 100 : 0) + "%" }} />
            </div>
            <span>{progress.percent}%</span>
          </div></td>
          <td>{project.members.length}</td>
        </tr>;
      })}</tbody>
    </table></div>}
  </>;
}

