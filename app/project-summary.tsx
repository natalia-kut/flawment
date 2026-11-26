import Link from "next/link";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectStatusLabels } from "@/lib/projects/labels";
import { isTaskOverdue, taskProgress } from "@/lib/tasks/board";
import { dueLabel, ProgressRing } from "./project-browser";
import card from "./project-browser.module.css";
import styles from "./project-summary.module.css";

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDay = (day: string) => date.format(new Date(day + "T00:00:00Z"));

/** The project at a glance, above its tabs: how far along, when, and what is late. */
export default function ProjectSummary({ project, today }: { project: WorkspaceProject; today: string }) {
  const progress = taskProgress(project.tasks);
  const overdue = project.tasks.filter((task) => isTaskOverdue(task, today)).length;
  const next = project.stages.filter((stage) => stage.deadline && stage.doneCount < stage.taskCount)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const due = dueLabel(project.end_date || null, project.status, today);
  return <dl className={"workspace-card " + styles.summary}>
    <div className={styles.progress}>
      <ProgressRing percent={progress.percent} done={project.status === "COMPLETED" || (progress.total > 0 && progress.percent === 100)} />
      <div><dt>Progress</dt><dd>{progress.total ? <>{progress.percent}% <small>{progress.done}/{progress.total} tasks</small></> : "No tasks yet"}</dd></div>
    </div>
    <div><dt>Status</dt><dd><span className={card.status} data-status={project.status}>{projectStatusLabels[project.status]}</span></dd></div>
    <div><dt>Period</dt><dd>{formatDay(project.start_date)} – {project.end_date ? formatDay(project.end_date) : "open"}
      {project.end_date && due.tone && <small className={styles.due} data-tone={due.tone}>{due.text}</small>}</dd></div>
    {next && <div><dt>Next stage</dt><dd>{next.name} <small>due {formatDay(next.deadline)}</small></dd></div>}
    <div><dt>Overdue</dt><dd>{overdue > 0
      ? <Link className={styles.overdue} href={`/?view=tasks&in=${project.id}&overdue=1`}><span className={card.dot} aria-hidden="true" />{overdue} {overdue === 1 ? "task" : "tasks"} →</Link>
      : "Nothing"}</dd></div>
  </dl>;
}
