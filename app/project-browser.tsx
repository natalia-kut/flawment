"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { filterProjects } from "@/lib/projects/filters";
import { taskProgress, isTaskOverdue } from "@/lib/tasks/board";
import ProgressBar from "@/components/ui/progress-bar";
import controls from "@/components/ui/filter-bar.module.css";
import { projectStatusLabels as statusLabels } from "@/lib/projects/labels";
import styles from "./project-browser.module.css";

const formatDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHOWN_PEOPLE = 3;

export default function ProjectBrowser({ projects, today }: { projects: WorkspaceProject[]; today: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const results = filterProjects(projects, { query, status, showArchived });
  const filtered = Boolean(query || status || showArchived);

  return <>
    <div className={controls.toolbar} role="group" aria-label="Project filters">
      <div className={controls.toolbarRow}>
        <input className={controls.search} type="search" aria-label="Search projects" placeholder="Search projects by name or description"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className={controls.filter} aria-label="Status" data-active={status !== ""} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className={controls.chip}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Show archived</label>
      </div>
    </div>
    <div className={controls.statusRow}>
      <div className={controls.statusText}>
        <p className={controls.status} role="status" aria-live="polite">Showing {results.length} of {projects.length} projects</p>
        {filtered && <button type="button" className={controls.clear}
          onClick={() => { setQuery(""); setStatus(""); setShowArchived(false); }}>Clear filters</button>}
      </div>
    </div>

    {results.length === 0 ? <section className="project-empty-state">
      <h2>No projects match your filters</h2><p>Try another search or clear the filters.</p>
    </section> : <div className={styles.tableWrap}><table className={styles.table}>
      <caption className={styles.caption}>Projects you can access</caption>
      <thead><tr><th scope="col">Name</th><th scope="col">Deadline</th><th scope="col">Status</th>
        <th scope="col">Progress</th><th scope="col">People</th></tr></thead>
      <tbody>{results.map((project) => {
        const progress = taskProgress(project.tasks);
        const overdue = project.tasks.filter((task) => isTaskOverdue(task, today)).length;
        const extra = project.members.length - SHOWN_PEOPLE;
        return <tr key={project.id}>
          {/* The name link stretches over the whole row, so any part of it opens the project. */}
          <th scope="row"><Link className={styles.rowLink} href={"/?project=" + project.id}>{project.name}</Link>
            {overdue > 0 && <Link className={styles.overdue} href={"/?view=tasks&in=" + project.id + "&overdue=1"}>{overdue} overdue {overdue === 1 ? "task" : "tasks"} →</Link>}</th>
          <td>{project.end_date ? formatDate.format(new Date(project.end_date + "T00:00:00Z")) : <span className={styles.none}>No deadline</span>}</td>
          <td><span className={styles.status} data-status={project.status}>{statusLabels[project.status]}</span></td>
          <td>{progress.total === 0
            ? <span className={styles.none}>No tasks yet</span>
            : <ProgressBar label={project.name} percent={progress.percent} caption={progress.percent + "%"} />}</td>
          <td>
            <span className={styles.people} aria-label={project.members.length + " people: " + project.members.map((m) => m.first_name + " " + m.last_name).join(", ")}>
              {project.members.slice(0, SHOWN_PEOPLE).map((member) =>
                <span key={member.id} className={styles.avatar} title={member.first_name + " " + member.last_name} aria-hidden="true">
                  {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                </span>)}
              {extra > 0 && <span className={styles.avatar + " " + styles.more} aria-hidden="true">+{extra}</span>}
            </span>
          </td>
        </tr>;
      })}</tbody>
    </table></div>}
  </>;
}
