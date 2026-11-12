"use client";

import Link from "next/link";
import TaskDetailsDialog from "./task-details-dialog";
import TaskDetailsForm from "./task-details-form";
import { formatTaskDeadline, taskPriorityLabels, taskStatusLabels } from "@/lib/tasks/labels";
import { useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorkspaceProject } from "@/lib/projects/data";
import { emptyTaskFilters, taskAssigneeKey, type TaskFilters } from "@/lib/tasks/filters";
import { getOverviewTasks, filterOverviewTasks } from "@/lib/tasks/overview";
import { boardColumns, isTaskOverdue, taskProgress } from "@/lib/tasks/board";
import { changeTaskStatusAction } from "@/lib/tasks/actions";
import styles from "./tasks-board.module.css";
import details from "@/components/ui/details-dialog.module.css";
import controls from "@/components/ui/filter-bar.module.css";
import ProgressBar from "@/components/ui/progress-bar";
import PageHeader from "@/components/page-header";
import { celebrate } from "@/components/ui/confetti";

// One full row of overdue tiles: 4 fills a row whether the box shows 4, 2 or 1 columns.
const OVERDUE_PREVIEW = 4;
const PROJECT_STORAGE_KEY = "flawment.tasks.project";
const ORDER_STORAGE_KEY = "flawment.tasks.projectOrder";

function readOrder(raw: string | null): number[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

type TaskStatus = ReturnType<typeof getOverviewTasks>[number]["status"];

export default function TasksOverview({ projects, currentUserId, today }: {
  projects: WorkspaceProject[]; currentUserId: number; today: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<TaskFilters>({ ...emptyTaskFilters });
  // "" shows every project. The last choice is remembered on this device;
  // until the user picks one here, the remembered one (if it still exists) is used.
  const remembered = useSyncExternalStore(subscribeToStorage,
    () => localStorage.getItem(PROJECT_STORAGE_KEY), () => null);
  // A link can open the board on one project (?in=ID), e.g. "5 overdue tasks" on the Projects page.
  const search = useSearchParams();
  const linkedProject = search.get("in");
  const [chosenProjectId, setProjectId] = useState<string | null>(
    linkedProject && projects.some((project) => String(project.id) === linkedProject) ? linkedProject : null);
  // Tabs: A–Z by default; once the user drags them, their own order (new projects join A–Z at the end).
  const savedOrder = readOrder(useSyncExternalStore(subscribeToStorage,
    () => localStorage.getItem(ORDER_STORAGE_KEY), () => null));
  const position = (id: number) => { const index = savedOrder.indexOf(id); return index < 0 ? Infinity : index; };
  const sortedProjects = [...projects].sort((a, b) =>
    position(a.id) - position(b.id) || a.name.localeCompare(b.name));
  const alphabetical = [...projects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => project.id);
  const sameAsAlphabetical = (ids: number[]) => ids.length === alphabetical.length && ids.every((id, index) => id === alphabetical[index]);
  // Only an order that really differs from A–Z counts as the user's own.
  const customOrder = !sameAsAlphabetical(sortedProjects.map((project) => project.id));
  // Projects you can add a task to (A–Z); the selected tab's project is picked first.
  const creatable = [...projects].filter((project) => project.canCreateTasks).sort((a, b) => a.name.localeCompare(b.name));
  const [draggingTab, setDraggingTab] = useState<number | null>(null);
  // While a tab is dragged, the others make room live; dropping saves this order, cancelling drops it.
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const orderedProjects = dragOrder
    ? dragOrder.flatMap((id) => sortedProjects.filter((project) => project.id === id))
    : sortedProjects;
  const projectId = chosenProjectId
    ?? (remembered && projects.some((project) => String(project.id) === remembered) ? remembered : "");
  // Groups the user opened or closed by hand; the rest follow their default.
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({});
  const [groupBy, setGroupBy] = useState<"project" | "person">("project");
  const [overdueOnly, setOverdueOnly] = useState(search.get("overdue") === "1");
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [mineOnly, setMineOnly] = useState(search.get("mine") === "1");
  const [dragging, setDragging] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [detailsId, setDetailsId] = useState<number | null>(null);
  // A new task: in one project (its "+ Add task"), or "choose" one in the form (the header button).
  const [creatingIn, setCreatingIn] = useState<number | "choose" | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Statuses moved on the board but not yet confirmed by fresh server data.
  const [pending, setPending] = useState<Record<number, TaskStatus>>({});
  const [seenProjects, setSeenProjects] = useState(projects);
  const serverTasks = getOverviewTasks(projects);
  if (projects !== seenProjects) {
    // New server data: drop the moves it now confirms.
    setSeenProjects(projects);
    setPending((current) => Object.fromEntries(Object.entries(current).filter(([id, status]) =>
      serverTasks.find((task) => task.id === Number(id))?.status !== status)));
  }
  const allTasks = serverTasks.map((task) => task.id in pending ? { ...task, status: pending[task.id] } : task);
  const detailsTask = allTasks.find((task) => task.id === detailsId);
  const detailsProject = detailsTask && projects.find((project) => project.id === detailsTask.projectId);
  const detailsSource = detailsProject?.tasks.find((task) => task.id === detailsId);
  function openDetails(id: number) { setDetailsId(id); }
  function closeDetails() { setDetailsId(null); }
  const formatShortDeadline = (value: string) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z")) : "No deadline";
  type BoardTask = (typeof allTasks)[number];
  const tasks = filterOverviewTasks(allTasks, filters, projectId)
    .filter((task) => (!overdueOnly || isTaskOverdue(task, today)) &&
      (!mineOnly || task.assignedTo === currentUserId));
  // Most overdue first. Deadlines are YYYY-MM-DD, so they sort as text.
  const overdue = allTasks.filter((task) => isTaskOverdue(task, today) && (!projectId || String(task.projectId) === projectId))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const daysLate = (deadline: string) => Math.round((Date.parse(today) - Date.parse(deadline)) / 86_400_000);
  const overdueShown = showAllOverdue ? overdue : overdue.slice(0, OVERDUE_PREVIEW);
  const assignees = Array.from(new Map(allTasks.map((task) =>
    [taskAssigneeKey(task), task.assigneeName] as const
  ))).filter(([key]) => key !== "unassigned").sort((a, b) => a[1].localeCompare(b[1]));
  // With one project picked there is nothing to group by project: it is one board.
  const singleProject = projectId !== "";
  const grouping = singleProject ? "project" : groupBy;
  const scopeTasks = singleProject ? allTasks.filter((task) => String(task.projectId) === projectId) : allTasks;
  const scopeProgress = taskProgress(scopeTasks);
  const selectedProject = projects.find((project) => String(project.id) === projectId);
  const groups = Array.from(new Map(tasks.map((task) => grouping === "project"
    ? [String(task.projectId), task.projectName] as const
    : [taskAssigneeKey(task), task.assigneeName] as const)));
  const groupKey = (task: BoardTask) => grouping === "project" ? String(task.projectId) : taskAssigneeKey(task);
  function saveOrder(ids: number[] | null) {
    animate(() => {
      if (ids && !sameAsAlphabetical(ids)) localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
      else localStorage.removeItem(ORDER_STORAGE_KEY);
      // The storage event only reaches other tabs; tell this one too.
      window.dispatchEvent(new StorageEvent("storage", { key: ORDER_STORAGE_KEY }));
    });
  }
  function moveTab(id: number, toIndex: number) {
    const ids = sortedProjects.map((project) => project.id).filter((item) => item !== id);
    ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, id);
    saveOrder(ids);
  }
  function selectProject(id: string) {
    setProjectId(id); update("stage", ""); setShowAllOverdue(false);
    if (id) localStorage.setItem(PROJECT_STORAGE_KEY, id);
    else localStorage.removeItem(PROJECT_STORAGE_KEY);
  }
  function update(key: keyof TaskFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  // Let the browser glide each card from its old place to its new one.
  function animate(update: () => void) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A view transition draws above everything, open dialogs included, so a card
    // moved from the task dialog would fly across it. Under a dialog, just update.
    const dialogOpen = document.querySelector("dialog[open]") !== null;
    if (!document.startViewTransition || reduceMotion || dialogOpen) { update(); return; }
    document.startViewTransition(() => flushSync(update));
  }
  function undoMove(taskId: number) {
    animate(() => setPending((current) => {
      const rest = { ...current };
      delete rest[taskId];
      return rest;
    }));
  }
  async function move(task: BoardTask, status: TaskStatus, origin?: { x: number; y: number }) {
    if (saving !== null || status === task.status || !task.canChangeStatus) return;
    const expected = serverTasks.find((item) => item.id === task.id)?.status ?? task.status;
    setError(""); setMessage("");
    // Move the card right away; the server confirms it in the background.
    animate(() => {
      setPending((current) => ({ ...current, [task.id]: status }));
      setSaving(task.id); setDragging(null); setDropTarget(null);
    });
    try {
      const data = new FormData();
      data.set("project_id", String(task.projectId));
      data.set("task_id", String(task.id));
      data.set("status", status);
      data.set("expected_status", expected);
      const result = await changeTaskStatusAction(data);
      if (result.error) { setError(result.error); undoMove(task.id); }
      else {
        setMessage('Status saved for "' + task.title + '".');
        if (status === "COMPLETED") {
          // Finishing the last open task of a project, or your own last one, earns the big burst.
          const stillOpen = (other: BoardTask) => other.id !== task.id && other.status !== "COMPLETED" && other.status !== "CANCELLED";
          const projectCleared = !allTasks.some((other) => other.projectId === task.projectId && stillOpen(other));
          const mineCleared = task.assignedTo === currentUserId && !allTasks.some((other) => other.assignedTo === currentUserId && stillOpen(other));
          celebrate(projectCleared || mineCleared ? "big" : "small", origin);
        }
      }
      router.refresh();
    } catch {
      setError("Could not move the task. Please try again.");
      undoMove(task.id);
    } finally {
      setSaving(null);
    }
  }
  return <div className={styles.page}>
    {/* Grouped by project, each project adds its own tasks; otherwise a project is picked in the form. */}
    <PageHeader title="Tasks" actions={creatable.length > 0 && (grouping === "person" || tasks.length === 0) &&
      <button className="primary-button" onClick={() => setCreatingIn("choose")}><span aria-hidden="true">+</span> New task</button>} />
    {projects.length > 1 && <div className={styles.projectTabs} role="group" aria-label="Show tasks from"
      onDragOver={(event) => { if (draggingTab !== null) event.preventDefault(); }}
      onDrop={(event) => {
        // Anywhere on the row counts, gaps included.
        event.preventDefault();
        if (dragOrder) saveOrder(dragOrder);
        setDraggingTab(null); setDragOrder(null);
      }}>
      <button type="button" aria-pressed={projectId === ""} onClick={() => selectProject("")}>
        <span className={styles.tabName}>All projects</span><span className={styles.tabCount}>{allTasks.length}</span>
      </button>
      {orderedProjects.map((project, index) => <button key={project.id} type="button"
        aria-pressed={projectId === String(project.id)} title={project.name + " · drag or Alt+←/→ to reorder"}
        className={draggingTab === project.id ? styles.tabDragging : undefined}
        style={{ viewTransitionName: "project-tab-" + project.id }}
        draggable
        onClick={() => selectProject(String(project.id))}
        onKeyDown={(event) => {
          if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
          event.preventDefault();
          moveTab(project.id, index + (event.key === "ArrowLeft" ? -1 : 1));
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", project.name);
          event.dataTransfer.effectAllowed = "move";
          setDraggingTab(project.id); setDragOrder(sortedProjects.map((item) => item.id));
        }}
        onDragEnter={() => {
          if (draggingTab === null || draggingTab === project.id || !dragOrder) return;
          const ids = dragOrder.filter((id) => id !== draggingTab);
          ids.splice(index, 0, draggingTab);
          setDragOrder(ids);
        }}
        onDragEnd={() => { setDraggingTab(null); setDragOrder(null); }}>
        <span className={styles.tabName}>{project.name}</span><span className={styles.tabCount}>{project.tasks.length}</span>
      </button>)}
      {customOrder && <button type="button" className={styles.resetOrder} onClick={() => saveOrder(null)}>Reset to A–Z</button>}
    </div>}
    {overdue.length > 0 && !overdueOnly && <section className={styles.overdue} aria-label="Overdue tasks">
      <div className={styles.groupHeading}><h2>Overdue · {overdue.length}</h2>
        <button className="secondary-button" onClick={() => {
          setOverdueOnly(true); setFilters({ ...emptyTaskFilters }); setMineOnly(false);
        }}>Show only overdue</button>
      </div>
      <ul>{overdueShown.map((task) => {
        const late = daysLate(task.deadline);
        return <li key={task.id}>
          <button type="button" className={styles.overdueItem} onClick={() => openDetails(task.id)}
            title={task.title + " · due " + formatTaskDeadline(task.deadline)}>
            <strong>{task.title}</strong>
            <span className={styles.overdueMeta}>
              <span>{task.assigneeName}</span>
              <span className={styles.daysLate}>{late === 1 ? "1 day late" : late + " days late"}</span>
            </span>
          </button>
        </li>;
      })}</ul>
      {overdue.length > OVERDUE_PREVIEW && <button type="button" className={styles.showMore} aria-expanded={showAllOverdue}
        onClick={() => setShowAllOverdue(!showAllOverdue)}>
        {showAllOverdue ? "Show fewer" : "Show all " + overdue.length}
      </button>}
    </section>}
    <div className={controls.toolbar} role="group" aria-label="Task filters">
      <div className={controls.toolbarRow}>
        <input className={controls.search} type="search" aria-label="Search tasks" placeholder="Search tasks by title or description"
          value={filters.query} onChange={(e) => update("query", e.target.value)} />
        {!singleProject && <div className={styles.toggle} role="group" aria-label="Group tasks">
          <button aria-pressed={groupBy === "project"} onClick={() => setGroupBy("project")}>By project</button>
          <button aria-pressed={groupBy === "person"} onClick={() => setGroupBy("person")}>By person</button>
        </div>}
      </div>
      <div className={controls.toolbarRow}>
        {/* The first option names each filter, so the pills need no labels above them. */}
        <select className={controls.filter} aria-label="Assignee" data-active={filters.assignee !== ""} value={filters.assignee}
          onChange={(e) => update("assignee", e.target.value)}>
          <option value="">Everyone</option><option value="unassigned">Unassigned</option>
          {assignees.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        <select className={controls.filter} aria-label="Stage" data-active={filters.stage !== ""} value={filters.stage}
          onChange={(e) => update("stage", e.target.value)}>
          <option value="">All stages</option><option value="none">No stage</option>
          {projects.filter((project) => !projectId || String(project.id) === projectId).flatMap((project) =>
            project.stages.map((stage) => <option key={stage.id} value={stage.id}>{singleProject ? stage.name : project.name + " · " + stage.name}</option>))}
        </select>
        <select className={controls.filter} aria-label="Priority" data-active={filters.priority !== ""} value={filters.priority}
          onChange={(e) => update("priority", e.target.value)}>
          <option value="">Any priority</option>
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
        </select>
        <label className={controls.chip}><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />Overdue</label>
        <label className={controls.chip}><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />Only my tasks</label>
      </div>
    </div>
    <div className={controls.statusRow}>
      <div className={controls.statusText}>
        <p className={controls.status} role="status" aria-live="polite">{saving !== null ? "Saving task status…" : message || "Showing " + tasks.length + " of " + scopeTasks.length + " tasks"}</p>
        {(overdueOnly || mineOnly || Object.values(filters).some(Boolean)) && <button className={controls.clear} type="button"
          onClick={() => { setFilters({ ...emptyTaskFilters }); setOverdueOnly(false); setMineOnly(false); }}>
          Clear filters
        </button>}
      </div>
      {/* One project: its progress sits here, always visible, so the board starts at the same place even when nothing matches. */}
      {singleProject && <ProgressBar label={selectedProject?.name ?? "Project"} percent={scopeProgress.percent} caption={scopeProgress.done + "/" + scopeProgress.total + " done"} />}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {allTasks.length === 0 ? <section className="workspace-card"><h2>No tasks yet</h2><p>Create tasks inside a project to get started.</p><Link href="/?view=projects">Open projects</Link></section>
      : tasks.length === 0
        // Nothing matches: keep the board's shape, with every status column empty.
        ? <section className={styles.group} aria-label="No tasks match your filters">
          <div className={styles.columns}>
            {boardColumns.filter((column) => column.status !== "CANCELLED").map((column) =>
              <section key={column.status} className={styles.column} aria-label={column.label}>
                <h3>{column.label} · 0</h3>
                <p className={styles.dropHint}>No tasks</p>
              </section>)}
          </div>
        </section>
      : groups.map(([key, name]) => {
        const groupTasks = tasks.filter((task) => groupKey(task) === key);
        const progress = taskProgress(allTasks.filter((task) => groupKey(task) === key));
        // Finished groups start folded away; a single group is always open.
        const collapsible = groups.length > 1;
        const collapsed = collapsible && (toggledGroups[key] ?? (progress.total > 0 && progress.percent === 100));
        const boardId = "board-" + grouping + "-" + key;
        // Grouped by project: "+ Add task" at the foot of To do, straight into this project.
        const addTo = grouping === "project" ? creatable.find((project) => String(project.id) === key) : undefined;
        return <section key={key} className={styles.group} aria-label={name}>
          {!singleProject && <div className={styles.groupHeading}>
            {collapsible ? <h2><button type="button" className={styles.groupToggle} aria-expanded={!collapsed} aria-controls={boardId}
              onClick={() => setToggledGroups((current) => ({ ...current, [key]: !collapsed }))}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              {name}<span className={styles.groupCount}>{groupTasks.length}</span>
            </button></h2> : <h2>{name}</h2>}
            <ProgressBar label={name} percent={progress.percent} caption={progress.done + "/" + progress.total + " done"} />
          </div>}
          {!collapsed && <div className={styles.columns} id={boardId}>
            {boardColumns.filter((column) => column.status !== "CANCELLED" || groupTasks.some((task) => task.status === "CANCELLED")).map((column) => {
              const cards = groupTasks.filter((task) => task.status === column.status);
              const target = key + ":" + column.status;
              return <section key={column.status}
                className={styles.column + (dropTarget === target ? " " + styles.dropTarget : "")}
                aria-label={name + ": " + column.label}
                onDragOver={(event) => {
                  if (dragging === null || saving !== null) return;
                  event.preventDefault();
                  if (dropTarget !== target) setDropTarget(target);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const task = allTasks.find((item) => item.id === dragging);
                  setDragging(null); setDropTarget(null);
                  // The confetti for a finished task bursts from where the card was dropped.
                  if (task && groupKey(task) === key) void move(task, column.status, { x: event.clientX, y: event.clientY });
                  else if (task) setError("Move tasks between status columns within the same group.");
                }}>
                <h3>{column.label} · {cards.length}</h3>
                {cards.map((task) => <article key={task.id}
                  className={styles.card + (isTaskOverdue(task, today) ? " " + styles.late : "") + (dragging === task.id ? " " + styles.dragging : "")}
                  style={{ viewTransitionName: "task-card-" + task.id, viewTransitionClass: "task-card" }}
                  draggable={task.canChangeStatus && saving === null}
                  aria-busy={saving === task.id}
                  role="button" tabIndex={0} aria-label={"View task: " + task.title}
                  onClick={() => openDetails(task.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault(); openDetails(task.id);
                    }
                  }}
                  onDragStart={(event) => {
                    if (!task.canChangeStatus || saving !== null) { event.preventDefault(); return; }
                    event.dataTransfer.setData("text/plain", String(task.id));
                    event.dataTransfer.effectAllowed = "move"; setDragging(task.id);
                  }}
                  onDragEnd={() => { setDragging(null); setDropTarget(null); }}>
                  <div className={styles.cardMeta}><span>{task.assigneeName}</span><span className={styles.badge} data-priority={task.priority}>{task.priority.toLowerCase()}</span></div>
                  <h4>{task.title}</h4>
                  <p className={isTaskOverdue(task, today) ? styles.lateText : ""}>{isTaskOverdue(task, today) ? "Overdue · " : ""}{formatShortDeadline(task.deadline)}</p>
                </article>)}
                {cards.length === 0 && !(column.status === "TO_DO" && addTo) && <p className={styles.dropHint}>No tasks</p>}
                {column.status === "TO_DO" && addTo && <button type="button" className={styles.addTask} onClick={() => setCreatingIn(addTo.id)}>
                  <span aria-hidden="true">+</span> Add task</button>}
              </section>;
            })}
          </div>}
        </section>;
      })}
    {creatingIn !== null && <TaskDetailsForm
      project={creatable.find((p) => creatingIn === "choose" ? String(p.id) === chosenProjectId : p.id === creatingIn) ?? creatable[0]}
      projectChoices={creatingIn === "choose" ? creatable : undefined} showOpenProject={false} onClose={() => setCreatingIn(null)}
      onSaved={() => { setMessage("Task added."); setCreatingIn(null); router.refresh(); }} />}
    {detailsTask && (detailsProject && detailsSource?.canEdit
      // Whoever may edit the task (its coordinators, or the contributor who added it) edits it right here.
      ? <TaskDetailsForm key={detailsSource.id} project={detailsProject} task={detailsSource}
        overdue={isTaskOverdue(detailsTask, today)} onClose={closeDetails}
        onSaved={() => { setMessage('Saved "' + detailsSource.title + '".'); closeDetails(); router.refresh(); }} />
      : <TaskDetailsDialog title={detailsTask.title} onClose={closeDetails}>
        <p className={details.detailsContext}>{detailsTask.projectName} · {detailsTask.stageName}</p>
        <p className={detailsTask.description ? details.detailsDescription : details.detailsEmpty}>
          {detailsTask.description || "No description yet."}
        </p>
        <dl className={details.detailsFacts}>
          <div><dt>Status</dt><dd>{detailsTask.canChangeStatus
            ? <select className={details.detailsStatus} aria-label={"Status for " + detailsTask.title} value={detailsTask.status}
              disabled={saving !== null} onChange={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                void move(detailsTask, event.target.value as TaskStatus, { x: box.left + box.width / 2, y: box.top });
              }}>
              {boardColumns.map((option) => <option key={option.status} value={option.status}>{taskStatusLabels[option.status]}</option>)}
            </select>
            : taskStatusLabels[detailsTask.status]}</dd></div>
          <div><dt>Priority</dt><dd><span className={styles.badge} data-priority={detailsTask.priority}>{taskPriorityLabels[detailsTask.priority]}</span></dd></div>
          <div><dt>Assigned to</dt><dd>{detailsTask.assigneeName}</dd></div>
          <div><dt>Deadline</dt><dd className={isTaskOverdue(detailsTask, today) ? styles.lateText : undefined}>
            {formatTaskDeadline(detailsTask.deadline)}{isTaskOverdue(detailsTask, today) ? " · overdue" : ""}
          </dd></div>
        </dl>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <Link className="secondary-button" href={"/?project=" + detailsTask.projectId}>Open project</Link>
        </div>
      </TaskDetailsDialog>)}
  </div>;
}
