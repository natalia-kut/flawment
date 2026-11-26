import { addDays, daysBetween, formatDay, formatShortDay, isOpen, isOverdue } from "@/lib/documents/engine";
import { stageRows } from "@/lib/documents/stages";
import { formatMonthTick } from "@/lib/time-off/dates";
import { taskStatusLabels, type DocumentProject } from "@/lib/documents/types";

const MAX_MONTHS = 8;

/** Stages one under another: how much is done, and where their tasks and deadlines fall on the calendar. */
export default function StageRoadmap({ project, today }: { project: DocumentProject; today: string }) {
  const rows = stageRows(project, today);
  if (project.stages.length === 0) return <p className="document-muted">This project has no stages yet. Add them on the project page.</p>;

  const dates = [project.startDate, project.endDate, today, ...project.stages.map((stage) => stage.deadline),
    ...rows.flatMap((row) => row.tasks.map((task) => task.deadline))].filter((day): day is string => day !== null).sort();
  // A little room on both sides, so the outermost marks are not cut off.
  const margin = Math.max(Math.ceil(daysBetween(dates[0], dates.at(-1)!) * 0.03), 1);
  const from = addDays(dates[0], -margin);
  const total = daysBetween(from, addDays(dates.at(-1)!, margin));
  const left = (day: string) => `${(daysBetween(from, day) / total) * 100}%`;

  const months: string[] = [];
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (daysBetween(from, cursor.toISOString().slice(0, 10)) < total) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const step = Math.ceil(months.length / MAX_MONTHS);
  const shownMonths = months.filter((_, index) => index % step === 0);

  return (
    <>
      <ul className="chart-legend">
        <li><span className="chart-swatch swatch-stage" aria-hidden="true" />Stage deadline</li>
        <li><span className="chart-swatch swatch-task-open" aria-hidden="true" />Open task</li>
        <li><span className="chart-swatch swatch-task-done" aria-hidden="true" />Done</li>
        <li><span className="chart-swatch swatch-task-late" aria-hidden="true" />Late</li>
      </ul>
      <div className="roadmap">
        <div className="roadmap-row roadmap-head">
          <span>Stage</span><span>Done</span>
          <span className="roadmap-track">
            {shownMonths.map((month, index) => <span key={month} className="roadmap-month" style={{ left: left(month) }}>{formatMonthTick(month, index === 0)}</span>)}
          </span>
        </div>
        {rows.map(({ stage, tasks, done, state, label }) => (
          <div className="roadmap-row" key={stage?.id ?? "none"} data-state={state}>
            <div className="roadmap-name">
              <strong>{stage?.name ?? "No stage"}</strong>
              <small>{stage?.deadline ? `${formatDay(stage.deadline)} · ${label}` : label}</small>
            </div>
            <div className="roadmap-done">
              <span>{done}/{tasks.length}</span>
              <span className="roadmap-bar"><span style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} /></span>
            </div>
            <div className="roadmap-track">
              {shownMonths.map((month) => <span key={month} className="roadmap-grid" style={{ left: left(month) }} />)}
              <span className="roadmap-today" style={{ left: left(today) }} />
              {tasks.filter((task) => task.deadline).map((task) => (
                <span key={task.id} className="roadmap-task" style={{ left: left(task.deadline!) }}
                  data-state={!isOpen(task) ? "done" : isOverdue(task, today) ? "late" : "open"}
                  title={`${task.title} · ${formatShortDay(task.deadline!)} · ${taskStatusLabels[task.status]}`} />
              ))}
              {stage?.deadline && <span className="roadmap-stage" style={{ left: left(stage.deadline) }} title={`${stage.name} · ${formatDay(stage.deadline)}`} />}
            </div>
          </div>
        ))}
        <div className="roadmap-row roadmap-foot" aria-hidden="true">
          <span /><span />
          <span className="roadmap-track"><span className="roadmap-month today" style={{ left: left(today) }}>Today</span></span>
        </div>
      </div>
    </>
  );
}
