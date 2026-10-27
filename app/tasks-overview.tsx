"use client";

import Link from "next/link";
import TaskDetailsDialog from "./task-details-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceProject } from "@/lib/projects/data";
import { emptyTaskFilters, taskAssigneeKey, type TaskFilters } from "@/lib/tasks/filters";
import { getOverviewTasks, filterOverviewTasks } from "@/lib/tasks/overview";
import { boardColumns, isTaskOverdue, taskProgress } from "@/lib/tasks/board";
import { changeTaskStatusAction } from "@/lib/tasks/actions";
import styles from "./tasks-board.module.css";

export default function TasksOverview({ projects, currentUserId, today }: {
  projects: WorkspaceProject[]; currentUserId: number; today: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<TaskFilters>({ ...emptyTaskFilters });
  const [projectId, setProjectId] = useState("");
  const [groupBy, setGroupBy] = useState<"project" | "person">("project");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const allTasks = getOverviewTasks(projects);
  const detailsTask = allTasks.find((task) => task.id === detailsId);
  const formatDeadline = (value: string) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z")) : "No deadline";
  type BoardTask = (typeof allTasks)[number];
  const tasks = filterOverviewTasks(allTasks, filters, projectId)
    .filter((task) => (!overdueOnly || isTaskOverdue(task, today)) &&
      (!mineOnly || task.assignedTo === currentUserId));
  const overdue = allTasks.filter((task) => isTaskOverdue(task, today));
  const assignees = Array.from(new Map(allTasks.map((task) =>
    [taskAssigneeKey(task), task.assigneeName] as const
  ))).filter(([key]) => key !== "unassigned").sort((a, b) => a[1].localeCompare(b[1]));
  const groups = Array.from(new Map(tasks.map((task) => groupBy === "project"
    ? [String(task.projectId), task.projectName] as const
    : [taskAssigneeKey(task), task.assigneeName] as const)));
  const groupKey = (task: BoardTask) => groupBy === "project" ? String(task.projectId) : taskAssigneeKey(task);
  function update(key: keyof TaskFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  async function move(task: BoardTask, status: string) {
    if (saving !== null || status === task.status || !task.canChangeStatus) return;
    setSaving(task.id); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.set("project_id", String(task.projectId));
      data.set("task_id", String(task.id));
      data.set("status", status);
      data.set("expected_status", task.status);
      const result = await changeTaskStatusAction(data);
      if (result.error) { setError(result.error); router.refresh(); }
      else { setMessage('Status saved for "' + task.title + '".'); router.refresh(); }
    } catch {
      setError("Could not move the task. Please try again.");
    } finally {
      setSaving(null); setDragging(null);
    }
  }
  return <div className={styles.page}>
    <header className="page-header"><p className={styles.eyebrow}>DRAG CARDS BETWEEN COLUMNS</p><h1>Tasks</h1></header>
    {overdue.length > 0 && <section className={styles.overdue} aria-label="Overdue tasks">
      <div className={styles.groupHeading}><h2>Overdue · {overdue.length}</h2>
        <button className="secondary-button" onClick={() => {
          setOverdueOnly(true); setFilters({ ...emptyTaskFilters }); setProjectId(""); setMineOnly(false);
        }}>Show only overdue</button>
      </div>
      <ul>{overdue.map((task) => <li key={task.id}><strong>{task.title}</strong> · {task.assigneeName} · was due {task.deadline}</li>)}</ul>
    </section>}
    <div className={styles.toolbar} role="group" aria-label="Task filters">
      <div className={styles.toggle} role="group" aria-label="Group tasks">
        <button aria-pressed={groupBy === "project"} onClick={() => setGroupBy("project")}>By project</button>
        <button aria-pressed={groupBy === "person"} onClick={() => setGroupBy("person")}>By participant</button>
      </div>
      <label>Project<select value={projectId} onChange={(e) => { setProjectId(e.target.value); update("stage", ""); }}>
        <option value="">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select></label>
      <label>Participant<select value={filters.assignee} onChange={(e) => update("assignee", e.target.value)}>
        <option value="">All participants</option><option value="unassigned">Unassigned</option>
        {assignees.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select></label>
      <label>Stage<select value={filters.stage} onChange={(e) => update("stage", e.target.value)}>
        <option value="">All stages</option><option value="none">No stage</option>
        {projects.filter((project) => !projectId || String(project.id) === projectId).flatMap((project) =>
          project.stages.map((stage) => <option key={stage.id} value={stage.id}>{project.name} · {stage.name}</option>))}
      </select></label>
      <label>Priority<select value={filters.priority} onChange={(e) => update("priority", e.target.value)}>
        <option value="">Any priority</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label className={styles.check}><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />Overdue</label>
      <label className={styles.check}><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />Only my tasks</label>
      <label>Search tasks<input type="search" placeholder="Title or description" value={filters.query} onChange={(e) => update("query", e.target.value)} /></label>
      <button className="secondary-button" onClick={() => {
        setFilters({ ...emptyTaskFilters }); setProjectId(""); setOverdueOnly(false); setMineOnly(false);
      }}>Clear filters</button>
    </div>
    <p role="status" aria-live="polite">{saving !== null ? "Saving task status…" : message || "Showing " + tasks.length + " of " + allTasks.length + " tasks"}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {allTasks.length === 0 ? <section className="workspace-card"><h2>No tasks yet</h2><p>Create tasks inside a project to get started.</p><Link href="/">Open projects</Link></section>
      : tasks.length === 0 ? <section className="workspace-card"><h2>No tasks match your filters</h2><p>Try another search or clear the filters.</p></section>
      : groups.map(([key, name]) => {
        const groupTasks = tasks.filter((task) => groupKey(task) === key);
        const progress = taskProgress(allTasks.filter((task) => groupKey(task) === key));
        return <section key={key} className={styles.group} aria-label={name}>
          <div className={styles.groupHeading}><h2>{name}</h2>
            <div className={styles.progress}><progress max={100} value={progress.percent} aria-label={name + " completion"} /><span>{progress.done}/{progress.total} done</span></div>
          </div>
          <div className={styles.columns}>
            {boardColumns.filter((column) => column.status !== "CANCELLED" || groupTasks.some((task) => task.status === "CANCELLED")).map((column) => {
              const cards = groupTasks.filter((task) => task.status === column.status);
              return <section key={column.status} className={styles.column}
                aria-label={name + ": " + column.label}
                onDragOver={(event) => { if (dragging !== null && saving === null) event.preventDefault(); }}
                onDrop={(event) => {
                  event.preventDefault();
                  const task = allTasks.find((item) => item.id === dragging);
                  setDragging(null);
                  if (task && groupKey(task) === key) void move(task, column.status);
                  else if (task) setError("Move tasks between status columns within the same group.");
                }}>
                <h3>{column.label} · {cards.length}</h3>
                {cards.map((task) => <article key={task.id}
                  className={styles.card + (isTaskOverdue(task, today) ? " " + styles.late : "")}
                  draggable={task.canChangeStatus && saving === null}
                  aria-busy={saving === task.id}
                  role="button" tabIndex={0} aria-label={"View task: " + task.title}
                  onClick={() => setDetailsId(task.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault(); setDetailsId(task.id);
                    }
                  }}
                  onDragStart={(event) => {
                    if (!task.canChangeStatus || saving !== null) { event.preventDefault(); return; }
                    event.dataTransfer.setData("text/plain", String(task.id));
                    event.dataTransfer.effectAllowed = "move"; setDragging(task.id);
                  }}
                  onDragEnd={() => setDragging(null)}>
                  <div className={styles.cardMeta}><span>{task.assigneeName}</span><span className={styles.badge} data-priority={task.priority}>{task.priority.toLowerCase()}</span></div>
                  <h4>{task.title}</h4>
                  <p className={isTaskOverdue(task, today) ? styles.lateText : ""}>{isTaskOverdue(task, today) ? "Overdue · " : ""}{formatDeadline(task.deadline)}</p>
                </article>)}
                {cards.length === 0 && <p className={styles.dropHint}>No tasks</p>}
              </section>;
            })}
          </div>
        </section>;
      })}
    {detailsTask && <TaskDetailsDialog title={detailsTask.title} onClose={() => setDetailsId(null)}>
      <p>{detailsTask.description || "No description"}</p>
      <dl className={styles.detailsFacts}>
        <div><dt>Stage</dt><dd>{detailsTask.stageName}</dd></div>
        <div><dt>Project</dt><dd>{detailsTask.projectName}</dd></div>
        <div><dt>Assigned to</dt><dd>{detailsTask.assigneeName}</dd></div>
        <div><dt>Priority</dt><dd>{detailsTask.priority}</dd></div>
        <div><dt>Deadline</dt><dd>{formatDeadline(detailsTask.deadline)}</dd></div>
      </dl>
      {detailsTask.canChangeStatus && <label className={styles.statusLabel}>Move to
        <select aria-label={"Status for " + detailsTask.title} value={detailsTask.status} disabled={saving !== null}
          onChange={(event) => void move(detailsTask, event.target.value)}>
          {boardColumns.map((option) => <option key={option.status} value={option.status}>{option.label}</option>)}
        </select>
      </label>}
      {!detailsTask.canChangeStatus && <p>Status: {detailsTask.status.replaceAll("_", " ")}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><Link className="secondary-button" href={"/?project=" + detailsTask.projectId}>Open project</Link></div>
    </TaskDetailsDialog>}
  </div>;
}
