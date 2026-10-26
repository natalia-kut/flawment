import {
  addDays,
  countByStatus,
  daysBetween,
  describeTiming,
  formatDay,
  isOpen,
  isOverdue,
  projectPace,
} from "@/lib/documents/engine";
import type { ChartKind } from "@/lib/documents/template-schema";
import {
  taskPriorities,
  taskPriorityLabels,
  taskStatuses,
  taskStatusLabels,
  type DocumentProject,
  type DocumentTask,
  type TaskStatus,
} from "@/lib/documents/types";

// Inline SVG charts: vector in the exported PDF and no client-side library needed.
// Colors come from CSS classes in documents.css (.fill-<status>, .swatch-<status>).

type ChartProps = { project: DocumentProject; today: string };

const openStatuses = ["TO_DO", "IN_PROGRESS", "IN_REVIEW"] as const satisfies readonly TaskStatus[];

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

function ProgressVsTime({ project, today }: ChartProps) {
  const { progress, elapsed } = projectPace(project, today);
  const rows = [
    { label: "Tasks completed", value: progress, className: "fill-completed" },
    ...(elapsed === null ? [] : [{ label: "Time elapsed", value: elapsed, className: "fill-neutral" }]),
  ];
  const left = 118;
  const width = 640 - left - 46;

  let verdict = "The project has no end date, so progress cannot be compared with the schedule.";
  if (elapsed !== null) {
    const gap = progress - elapsed;
    verdict =
      Math.abs(gap) < 5
        ? "Completion is keeping pace with the schedule."
        : gap > 0
          ? `Completion is ${gap} points ahead of the time elapsed.`
          : `Completion is ${-gap} points behind the time elapsed.`;
  }

  return (
    <>
      <svg className="chart" viewBox={`0 0 640 ${rows.length * 34 + 6}`} role="img" aria-label="Progress compared with time elapsed">
        {rows.map((row, index) => {
          const y = index * 34 + 8;
          return (
            <g key={row.label}>
              <title>{`${row.label}: ${row.value}%`}</title>
              <text className="chart-label" x={0} y={y + 12}>{row.label}</text>
              <rect className="chart-track" x={left} y={y} width={width} height={18} rx={4} />
              {row.value > 0 && (
                <rect className={row.className} x={left} y={y} width={Math.max((width * row.value) / 100, 4)} height={18} rx={4} />
              )}
              <text className="chart-value" x={640} y={y + 13} textAnchor="end">{row.value}%</text>
            </g>
          );
        })}
      </svg>
      <p className="chart-caption">{verdict}</p>
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

function Workload({ project, today }: ChartProps) {
  const people = project.members.map((member) => ({ id: member.person.id, name: member.person.name }));
  const unassigned = project.tasks.filter((task) => isOpen(task) && !task.assignee);
  const rows = [
    ...people.map((person) => ({ ...person, tasks: project.tasks.filter((task) => isOpen(task) && task.assignee?.id === person.id) })),
    ...(unassigned.length > 0 ? [{ id: 0, name: "Unassigned", tasks: unassigned }] : []),
  ].sort((a, b) => b.tasks.length - a.tasks.length);

  const max = Math.max(...rows.map((row) => row.tasks.length), 1);
  if (rows.length === 0) return <Empty>This project has no members yet.</Empty>;

  const left = 150;
  const labelX = 640 - 96;
  const width = labelX - left - 14;
  const unit = width / max;

  return (
    <>
      <Legend
        items={openStatuses.map((status) => ({
          key: status,
          label: taskStatusLabels[status],
          className: `swatch-${status.toLowerCase()}`,
        }))}
      />
      <svg className="chart" viewBox={`0 0 640 ${rows.length * 26}`} role="img" aria-label="Open tasks per person">
        {rows.map((row, index) => {
          const y = index * 26 + 4;
          const overdue = row.tasks.filter((task) => isOverdue(task, today)).length;
          let offset = left;
          return (
            <g key={row.id}>
              <text className={`chart-label${row.id === 0 ? " muted" : ""}`} x={0} y={y + 12}>{row.name}</text>
              {openStatuses.map((status) => {
                const count = row.tasks.filter((task) => task.status === status).length;
                if (count === 0) return null;
                const segment = { x: offset, width: Math.max(count * unit - 2, 2) };
                offset += count * unit;
                return (
                  <rect
                    className={`fill-${status.toLowerCase()}`}
                    height={16}
                    key={status}
                    rx={3}
                    width={segment.width}
                    x={segment.x}
                    y={y}
                  >
                    <title>{`${row.name} — ${taskStatusLabels[status]}: ${count}`}</title>
                  </rect>
                );
              })}
              <text className="chart-value" x={labelX} y={y + 12}>
                {row.tasks.length} open
                {overdue > 0 && <tspan className="chart-late-text"> · {overdue} late</tspan>}
              </text>
            </g>
          );
        })}
      </svg>
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

// Light-to-dark terracotta ramp for counts; the lightest steps keep dark text.
const heatRamp = ["#f6dccb", "#edb995", "#e2925f", "#d65325", "#a83d1a", "#7a2a10"];

function PriorityMatrix({ project }: ChartProps) {
  if (project.tasks.length === 0) return <Empty>This project has no tasks yet.</Empty>;

  const count = (priority: string, status: string) =>
    project.tasks.filter((task) => task.priority === priority && task.status === status).length;
  const max = Math.max(...taskPriorities.flatMap((priority) => taskStatuses.map((status) => count(priority, status))), 1);
  const priorities = [...taskPriorities].reverse();

  return (
    <>
      <table className="heatmap">
        <thead>
          <tr>
            <th />
            {taskStatuses.map((status) => (
              <th key={status}>{taskStatusLabels[status]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {priorities.map((priority) => (
            <tr key={priority}>
              <th>{taskPriorityLabels[priority]}</th>
              {taskStatuses.map((status) => {
                const value = count(priority, status);
                const step = value === 0 ? -1 : Math.min(Math.ceil((value / max) * heatRamp.length) - 1, heatRamp.length - 1);
                return (
                  <td
                    className={step >= 3 ? "dark" : undefined}
                    key={status}
                    style={step >= 0 ? { background: heatRamp[step] } : undefined}
                    title={`${taskPriorityLabels[priority]} · ${taskStatusLabels[status]}: ${value}`}
                  >
                    {value || "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="chart-caption">Number of tasks per priority and status — darker cells hold more tasks.</p>
    </>
  );
}

export default function DocumentChart({ kind, project, today }: ChartProps & { kind: ChartKind }) {
  switch (kind) {
    case "status":
      return <StatusBreakdown project={project} today={today} />;
    case "progressVsTime":
      return <ProgressVsTime project={project} today={today} />;
    case "timeline":
      return <Timeline project={project} today={today} />;
    case "workload":
      return <Workload project={project} today={today} />;
    case "deadlineWeeks":
      return <DeadlineWeeks project={project} today={today} />;
    case "priorityMatrix":
      return <PriorityMatrix project={project} today={today} />;
  }
}
