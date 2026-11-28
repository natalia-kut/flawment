"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WorkspaceProject } from "@/lib/projects/data";
import { filterProjects } from "@/lib/projects/filters";
import { taskProgress, isTaskOverdue } from "@/lib/tasks/board";
import controls from "@/components/ui/filter-bar.module.css";
import { projectStatusLabels as statusLabels } from "@/lib/projects/labels";
import styles from "./project-browser.module.css";
import UserAvatar from "./user-avatar";

const formatDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const SHOWN_PEOPLE = 4;
const DAY = 86_400_000;

/** "Due 14 Mar 2027", "Due in 5 days", "Due today" or "Past due · 12 Nov 2026"; finished projects just name the date. */
export function dueLabel(end: string | null, status: string, today: string): { text: string; tone?: "soon" | "late" } {
  if (!end) return { text: "No deadline" };
  const date = formatDate.format(new Date(end + "T00:00:00Z"));
  if (status === "COMPLETED" || status === "CANCELLED" || status === "ARCHIVED") return { text: date };
  const days = Math.round((Date.parse(end) - Date.parse(today)) / DAY);
  if (days < 0) return { text: "Past due · " + date, tone: "late" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days <= 14) return { text: `Due in ${days} ${days === 1 ? "day" : "days"}`, tone: "soon" };
  return { text: "Due " + date };
}

/** How much of the project's work is done, as a ring; green once it is all done. */
export function ProgressRing({ percent, done }: { percent: number; done: boolean }) {
  const r = 17, c = 2 * Math.PI * r;
  return <svg className={styles.ring} data-done={done || undefined} width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
    <circle cx="21" cy="21" r={r} className={styles.ringTrack} />
    {/* No arc at 0: a round line cap would still draw a dot. */}
    {percent > 0 && <circle cx="21" cy="21" r={r} className={styles.ringFill} strokeDasharray={`${(percent / 100) * c} ${c}`} transform="rotate(-90 21 21)" />}
  </svg>;
}

export default function ProjectBrowser({ projects, today }: { projects: WorkspaceProject[]; today: string }) {
  // Kept in the address too, so opening a project and coming back (Back, the breadcrumb's history)
  // finds the list as it was. Written with history.replaceState: no server round trip per keystroke.
  const search = useSearchParams();
  const [query, setQueryState] = useState(search.get("q") ?? "");
  const [status, setStatusState] = useState(search.get("status") ?? "");
  const [showArchived, setShowArchivedState] = useState(search.get("archived") === "1");
  function remember(next: { q: string; status: string; archived: boolean }) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of [["q", next.q], ["status", next.status], ["archived", next.archived ? "1" : ""]] as const) {
      if (value) params.set(key, value); else params.delete(key);
    }
    window.history.replaceState(null, "", "?" + params.toString());
  }
  const setQuery = (q: string) => { setQueryState(q); remember({ q, status, archived: showArchived }); };
  const setStatus = (value: string) => { setStatusState(value); remember({ q: query, status: value, archived: showArchived }); };
  const setShowArchived = (archived: boolean) => { setShowArchivedState(archived); remember({ q: query, status, archived }); };
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
          onClick={() => { setQueryState(""); setStatusState(""); setShowArchivedState(false); remember({ q: "", status: "", archived: false }); }}>Clear filters</button>}
      </div>
    </div>

    {results.length === 0 ? <section className="project-empty-state">
      <h2>No projects match your filters</h2><p>Try another search or clear the filters.</p>
    </section> : <ul className={styles.grid} aria-label="Projects you can access">{results.map((project) => {
      const progress = taskProgress(project.tasks);
      const overdue = project.tasks.filter((task) => isTaskOverdue(task, today)).length;
      const extra = project.members.length - SHOWN_PEOPLE;
      const due = dueLabel(project.end_date, project.status, today);
      return <li key={project.id} className={styles.card}>
        {/* The name link stretches over the whole card, so any part of it opens the project. */}
        <h2 className={styles.name}><Link className={styles.cardLink} href={"/?project=" + project.id}>{project.name}</Link></h2>
        <p className={styles.description}>{project.description || <span className={styles.none}>No description yet.</span>}</p>

        <div className={styles.progress}>
          <ProgressRing percent={progress.total ? progress.percent : 0} done={project.status === "COMPLETED" || progress.complete} />
          <span><strong>{progress.total ? progress.percent + "%" : "—"}</strong>
            <small>{progress.total ? `${progress.done}/${progress.total} tasks done` : "No tasks yet"}</small></span>
        </div>

        <p className={styles.facts}>
          <span className={styles.status} data-status={project.status}>{statusLabels[project.status]}</span>
          <span className={styles.due} data-tone={due.tone}>{due.text}</span>
        </p>

        <div className={styles.foot}>
          {overdue > 0 ? <Link className={styles.overdue} href={"/?view=tasks&in=" + project.id + "&overdue=1"}>
            <span className={styles.dot} aria-hidden="true" />{overdue} overdue {overdue === 1 ? "task" : "tasks"} →</Link> : <span />}
          <span className={styles.people} aria-label={project.members.length + " people: " + project.members.map((m) => m.first_name + " " + m.last_name).join(", ")}>
            {project.members.slice(0, SHOWN_PEOPLE).map((member) => <span key={member.id} className={styles.face} title={member.first_name + " " + member.last_name}>
              <UserAvatar id={member.id} firstName={member.first_name} lastName={member.last_name} photoVersion={member.photoVersion} size={28} />
            </span>)}
            {extra > 0 && <span className={`${styles.face} ${styles.more}`} aria-hidden="true">+{extra}</span>}
          </span>
        </div>
      </li>;
    })}</ul>}
  </>;
}
