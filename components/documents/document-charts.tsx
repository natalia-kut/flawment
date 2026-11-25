import PaceChart from "./pace-chart";
import StageRoadmap from "./stage-roadmap";
import TeamPlanChart from "./team-plan-chart";
import {
  addDays,
  countByStatus,
  daysBetween,
  describeTiming,
  formatDay,
  isOpen,
  isOverdue,
} from "@/lib/documents/engine";
import type { ChartKind } from "@/lib/documents/template-schema";
import {
  taskStatuses,
  taskStatusLabels,
  type DocumentProject,
  type DocumentTask,
} from "@/lib/documents/types";

// Inline SVG charts: vector in the exported PDF and no client-side library needed.
// Colors come from CSS classes in documents.css (.fill-<status>, .swatch-<status>).

type ChartProps = { project: DocumentProject; today: string };

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

function utc(day: string) {
  return Date.parse(`${day}T00:00:00Z`);
}

function Legend({ items }: { items: { key: string; label: string; className: string }[] }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.key}>
          <span className={`chart-swatch ${item.className}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="document-muted">{children}</p>;
}

function StatusBreakdown({ project }: ChartProps) {
  const counts = countByStatus(project);
  const total = project.tasks.length;
  if (total === 0) return <Empty>This project has no tasks yet.</Empty>;

  return (
    <>
      <div className="status-bar" role="img" aria-label="Task status breakdown">
        {taskStatuses.map((status) =>
          counts[status] > 0 ? (
            <span
              className={`status-segment swatch-${status.toLowerCase()}`}
              key={status}
              style={{ flexGrow: counts[status] }}
              title={`${taskStatusLabels[status]}: ${counts[status]}`}
            />
          ) : null,
        )}
      </div>
      <ul className="chart-legend">
        {taskStatuses.map((status) => (
          <li key={status}>
            <span className={`chart-swatch swatch-${status.toLowerCase()}`} aria-hidden="true" />
            {taskStatusLabels[status]} <strong>{counts[status]}</strong>
            <span className="document-muted">({Math.round((counts[status] / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Timeline({ project, today }: ChartProps) {
  const scheduled = project.tasks.filter((task) => task.deadline !== null);
  const unscheduled = project.tasks.length - scheduled.length;
  const deadlines = scheduled.map((task) => task.deadline!).sort();

  const first = [project.startDate, deadlines[0] ?? project.startDate].sort()[0];
  const last = [project.endDate ?? today, deadlines.at(-1) ?? today, today].sort().at(-1)!;
  const span = Math.max(daysBetween(first, last), 1);
  const from = addDays(first, -Math.ceil(span * 0.03));
  const to = addDays(last, Math.ceil(span * 0.03));
  const total = daysBetween(from, to);

  const left = 8;
  const width = 624;
  const x = (day: string) => left + (daysBetween(from, day) / total) * width;

  // Tasks whose dots would overlap are merged into one larger dot showing how many tasks it holds.
  const groups: { tasks: DocumentTask[]; xs: number[] }[] = [];
  for (const task of [...scheduled].sort((a, b) => a.deadline!.localeCompare(b.deadline!))) {
    const position = x(task.deadline!);
    const last = groups.at(-1);
    if (last && position - last.xs[0] < 14) {
      last.tasks.push(task);
      last.xs.push(position);
    } else {
      groups.push({ tasks: [task], xs: [position] });
    }
  }
  const dots = groups.map(({ tasks, xs }) => {
    const statuses = new Set(tasks.map((task) => task.status));
    return {
      key: tasks.map((task) => task.id).join("-"),
      tasks,
      cx: xs.reduce((sum, value) => sum + value, 0) / xs.length,
      status: statuses.size === 1 ? tasks[0].status.toLowerCase() : "mixed",
      late: tasks.some((task) => isOverdue(task, today)),
    };
  });
  const hasMixed = dots.some((dot) => dot.status === "mixed");
  const hasGroups = dots.some((dot) => dot.tasks.length > 1);

  const trackY = 34;
  const axisY = trackY + 18;
  const height = axisY + 34;

  const months: string[] = [];
  const cursor = new Date(utc(from));
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.toISOString().slice(0, 10) < to) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const monthStep = Math.ceil(months.length / 8);

  const end = project.endDate ?? to;
  const todayX = x(today);
  const hasOverdue = scheduled.some((task) => isOverdue(task, today));

  return (
    <>
      <p className="chart-intro">
        Each dot is a task on its deadline, colored by its status.
        {hasGroups && " A number inside a dot shows several tasks due at almost the same time."}
      </p>
      <Legend
        items={[
          ...taskStatuses.map((status) => ({
            key: status,
            label: taskStatusLabels[status],
            className: `swatch-${status.toLowerCase()}`,
          })),
          ...(hasMixed ? [{ key: "mixed", label: "Mixed statuses", className: "swatch-mixed" }] : []),
          ...(hasOverdue ? [{ key: "late", label: "Past its deadline (red ring)", className: "swatch-late" }] : []),
        ]}
      />
      <svg className="chart" viewBox={`0 0 640 ${height}`} role="img" aria-label="Task deadlines on the project timeline">
        <text className="chart-label" x={x(project.startDate)} y={12}>Start · {formatDay(project.startDate)}</text>
        {project.endDate && (
          <text className="chart-label" x={x(project.endDate)} y={12} textAnchor="end">End · {formatDay(project.endDate)}</text>
        )}

        <rect className="chart-track" x={x(project.startDate)} y={trackY - 3} width={x(end) - x(project.startDate)} height={6} rx={3} />
        {today > project.startDate && (
          <rect
            className="chart-elapsed"
            x={x(project.startDate)}
            y={trackY - 3}
            width={Math.max(Math.min(todayX, x(end)) - x(project.startDate), 0)}
            height={6}
            rx={3}
          />
        )}

        <line className="chart-today" x1={todayX} x2={todayX} y1={20} y2={axisY} />

        {dots.map((dot) => (
          <g key={dot.key}>
            <title>
              {dot.tasks
                .map((task) => `${task.title} — ${formatDay(task.deadline)} — ${taskStatusLabels[task.status]} (${describeTiming(task, today)})`)
                .join("\n")}
            </title>
            <circle
              className={`chart-dot fill-${dot.status}${dot.late ? " late" : ""}`}
              cx={dot.cx}
              cy={trackY}
              r={dot.tasks.length > 1 ? 8 : 5}
            />
            {dot.tasks.length > 1 && (
              <text className={`chart-dot-count on-${dot.status}`} x={dot.cx} y={trackY + 3.5} textAnchor="middle">
                {dot.tasks.length}
              </text>
            )}
          </g>
        ))}

        <line className="chart-axis" x1={left} x2={left + width} y1={axisY} y2={axisY} />
        {months.map((month, index) =>
          index % monthStep === 0 ? (
            <g key={month}>
              <line className="chart-axis" x1={x(month)} x2={x(month)} y1={axisY} y2={axisY + 4} />
              <text className="chart-tick" x={x(month)} y={axisY + 15} textAnchor="middle">{monthName.format(utc(month))}</text>
            </g>
          ) : null,
        )}
        <text className="chart-today-label" x={Math.min(Math.max(todayX, 60), 580)} y={axisY + 30} textAnchor="middle">
          Today · {formatDay(today)}
        </text>
      </svg>
      {unscheduled > 0 && (
        <p className="chart-caption">
          {unscheduled} {unscheduled === 1 ? "task has" : "tasks have"} no deadline and {unscheduled === 1 ? "is" : "are"} not shown.
        </p>
      )}
    </>
  );
}

function DeadlineWeeks({ project, today }: ChartProps) {
  const open = project.tasks.filter((task) => isOpen(task) && task.deadline !== null);
  const mondayOf = (day: string) => addDays(day, -((new Date(utc(day)).getUTCDay() + 6) % 7));
  const thisWeek = mondayOf(today);

  // Late tasks sit in the week they were due (up to 6 weeks back, older ones grouped),
  // so the chart shows how late they are; then this week and 7 weeks ahead.
  const maxPast = 6;
  const overdue = open.filter((task) => isOverdue(task, today));
  const oldestLate = overdue.map((task) => mondayOf(task.deadline!)).sort()[0];
  const pastWeeks = oldestLate ? Math.min(Math.round(daysBetween(oldestLate, thisWeek) / 7), maxPast) : 0;
  const firstWeek = addDays(thisWeek, -pastWeeks * 7);
  const weeks = Array.from({ length: pastWeeks + 8 }, (_, index) => addDays(firstWeek, index * 7));
  const horizon = addDays(thisWeek, 56);
  const hasEarlier = overdue.some((task) => task.deadline! < firstWeek);

  const buckets = [
    ...(hasEarlier
      ? [{ key: "earlier", label: "Earlier", late: overdue.filter((task) => task.deadline! < firstWeek).length, upcoming: 0, past: true }]
      : []),
    ...weeks.map((start) => {
      const inWeek = open.filter((task) => task.deadline! >= start && task.deadline! < addDays(start, 7));
      const late = inWeek.filter((task) => isOverdue(task, today)).length;
      return {
        key: start,
        label: start === thisWeek ? "This week" : shortDate.format(utc(start)),
        late,
        upcoming: inWeek.length - late,
        past: start < thisWeek,
      };
    }),
  ];
  const later = open.filter((task) => task.deadline! >= horizon).length;
  const max = Math.max(...buckets.map((bucket) => bucket.late + bucket.upcoming), 1);

  const chartTop = 16;
  const chartHeight = 110;
  const baseline = chartTop + chartHeight;
  const slot = 640 / buckets.length;
  const barWidth = Math.min(slot - 12, 40);
  const nowX = buckets.findIndex((bucket) => bucket.key === thisWeek) * slot;

  return (
    <>
      <Legend
        items={[
          { key: "late", label: "Past its deadline", className: "swatch-late-fill" },
          { key: "upcoming", label: "Upcoming", className: "swatch-upcoming" },
        ]}
      />
      <svg className="chart" viewBox={`0 0 640 ${baseline + 22}`} role="img" aria-label="Open tasks per deadline week">
        {pastWeeks > 0 && <line className="chart-today" x1={nowX} x2={nowX} y1={4} y2={baseline + 4} />}
        {buckets.map((bucket, index) => {
          const total = bucket.late + bucket.upcoming;
          const cx = index * slot + slot / 2;
          const scale = (count: number) => (count / max) * chartHeight;
          const lateHeight = bucket.late > 0 ? Math.max(scale(bucket.late), 4) : 0;
          const upcomingHeight = bucket.upcoming > 0 ? Math.max(scale(bucket.upcoming), 4) : 0;
          const top = baseline - lateHeight - upcomingHeight - (lateHeight && upcomingHeight ? 2 : 0);
          return (
            <g key={bucket.key}>
              <title>
                {`${bucket.key === "earlier" ? "Earlier weeks" : `Week of ${formatDay(bucket.key)}`}: ` +
                  `${bucket.late} late, ${bucket.upcoming} upcoming`}
              </title>
              {lateHeight > 0 && (
                <rect className="fill-late" x={cx - barWidth / 2} y={baseline - lateHeight} width={barWidth} height={lateHeight} rx={3} />
              )}
              {upcomingHeight > 0 && (
                <rect className="fill-upcoming" x={cx - barWidth / 2} y={top} width={barWidth} height={upcomingHeight} rx={3} />
              )}
              {total > 0 && (
                <text className="chart-value" x={cx} y={top - 5} textAnchor="middle">{total}</text>
              )}
              <text className={`chart-tick${bucket.past ? " late" : ""}`} x={cx} y={baseline + 15} textAnchor="middle">
                {bucket.label}
              </text>
            </g>
          );
        })}
        <line className="chart-axis" x1={0} x2={640} y1={baseline} y2={baseline} />
      </svg>
      <p className="chart-caption">
        Open tasks by the week their deadline falls in (weeks start on Monday).
        {(pastWeeks > 0 || hasEarlier) && " Red weeks on the left are already past."}
        {later > 0 && ` ${later} more ${later === 1 ? "is" : "are"} due after ${formatDay(addDays(horizon, -1))}.`}
      </p>
    </>
  );
}

export default function DocumentChart({ kind, project, today }: ChartProps & { kind: ChartKind }) {
  switch (kind) {
    case "status":
      return <StatusBreakdown project={project} today={today} />;
    case "timeline":
      return <Timeline project={project} today={today} />;
    case "pace":
      return <PaceChart project={project} today={today} />;
    case "stageRoadmap":
      return <StageRoadmap project={project} today={today} />;
    case "teamPlan":
      return <TeamPlanChart project={project} today={today} />;
    case "deadlineWeeks":
      return <DeadlineWeeks project={project} today={today} />;
  }
}
