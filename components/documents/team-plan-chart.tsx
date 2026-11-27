import { useId } from "react";
import { formatShortDay as formatDay } from "@/lib/documents/engine";
import { conflictInsight, formatAbsence, unownedInsight } from "@/lib/documents/insights";
import { isWeekend, teamPlan } from "@/lib/documents/team-plan";
import type { DocumentProject } from "@/lib/documents/types";
import DocumentNotes from "./document-notes";

const WIDTH = 640, LEFT = 142, LATE = 40, LATER = 46, TOP = 40, ROW = 34;

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

const date = (day: string) => new Date(`${day}T00:00:00Z`);
/** SVG text does not wrap. */
const fit = (name: string) => (name.length > 23 ? name.slice(0, 22).trimEnd() + "…" : name);

/** Two weeks, a day per column: what each person has due, against the days they are away. */
export default function TeamPlanChart({ project, today }: { project: DocumentProject; today: string }) {
  const hatch = useId();
  const { days, rows, conflicts } = teamPlan(project, today);
  if (rows.length === 0) return <p className="document-muted">This project has no members yet.</p>;

  const step = (WIDTH - LEFT - LATE - LATER) / days.length;
  const x = (day: string) => LEFT + LATE + days.indexOf(day) * step;
  const bottom = TOP + rows.length * ROW;
  const firstDay = days[0], lastDay = days[days.length - 1];
  const unassignedDue = [...(rows.find((row) => row.personId === null)?.due.values() ?? [])].flat();
  const clashing = new Set(conflicts.map((conflict) => conflict.task.id));

  return (
    <>
      <ul className="chart-legend">
        <li><span className="chart-swatch swatch-plan-due" aria-hidden="true" />Due that day</li>
        <li><span className="chart-swatch swatch-plan-clash" aria-hidden="true" />Due while away</li>
        <li><span className="chart-swatch swatch-plan-away" aria-hidden="true" />Away</li>
      </ul>
      {/* The same plan as text, for screen readers: the chart's details are only in SVG titles. */}
      <ul className="visually-hidden">
        {rows.map((row) => {
          const due = [...row.due.entries()].flatMap(([day, tasks]) => tasks.map((task) => `${task.title} due ${formatDay(day)}`));
          const parts = [
            row.late.length ? `${row.late.length} late` : "",
            due.length ? `due: ${due.join(", ")}` : "nothing due in these two weeks",
            row.absences.length ? `away ${row.absences.map(formatAbsence).join(", ")}` : "",
          ].filter(Boolean);
          return <li key={row.personId ?? "unassigned"}>{row.name}: {parts.join("; ")}.</li>;
        })}
      </ul>
      {/* Scrolls sideways on a phone rather than shrinking the text to a few pixels. */}
      <div className="chart-scroll">
      <svg className="chart team-plan" viewBox={`0 0 ${WIDTH} ${bottom + 2}`} role="img"
        aria-label={`Deadlines and days away per person, ${formatDay(firstDay)} to ${formatDay(lastDay)}`}>
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="plan-away" />
            <rect width="2" height="6" className="plan-away-stripe" />
          </pattern>
        </defs>

        {days.map((day) => isWeekend(day) && <rect key={day} className="plan-weekend" x={x(day)} y={TOP} width={step} height={bottom - TOP} />)}
        <rect className="plan-today" x={x(today)} y={TOP - 24} width={step} height={bottom - TOP + 24} rx={4} />

        <text className="chart-tick" x={LEFT + LATE / 2} y={TOP - 9} textAnchor="middle">Late</text>
        {days.map((day, index) => {
          const cx = x(day) + step / 2;
          return (
            <g key={day}>
              {(index === 0 || day.endsWith("-01")) && <text className="plan-month" x={x(day) + 2} y={TOP - 30}>{month.format(date(day))}</text>}
              <text className="plan-weekday" x={cx} y={TOP - 15} textAnchor="middle">{weekday.format(date(day))}</text>
              <text className={`chart-tick${day === today ? " plan-today-label" : ""}`} x={cx} y={TOP - 4} textAnchor="middle">{Number(day.slice(8))}</text>
            </g>
          );
        })}
        <text className="chart-tick" x={WIDTH - LATER / 2} y={TOP - 9} textAnchor="middle">Later</text>

        {rows.map((row, index) => {
          const y = TOP + index * ROW;
          const middle = y + ROW / 2;
          return (
            <g key={row.personId ?? "unassigned"}>
              <line className="plan-line" x1={0} x2={WIDTH} y1={y} y2={y} />
              <text className={`chart-label${row.personId === null ? " muted" : ""}`} x={0} y={middle + 4}>{fit(row.name)}<title>{row.name}</title></text>
              {row.late.length > 0 && <text className="chart-value chart-late-text" x={LEFT + LATE / 2} y={middle + 4} textAnchor="middle">{row.late.length}</text>}
              {row.absences.map((absence) => {
                const from = absence.start < firstDay ? firstDay : absence.start;
                const to = absence.end > lastDay ? lastDay : absence.end;
                return (
                  <rect key={absence.start} fill={`url(#${hatch})`} x={x(from) + 1} y={y + 6} width={x(to) + step - x(from) - 2} height={ROW - 12} rx={5}>
                    <title>{`${row.name} is away ${formatAbsence(absence)}`}</title>
                  </rect>
                );
              })}
              {[...row.due].map(([day, tasks]) => {
                const clash = tasks.some((task) => clashing.has(task.id));
                return (
                  <g key={day}>
                    <title>{`${row.name}, ${formatDay(day)}: ${tasks.map((task) => task.title).join(", ")}`}</title>
                    <circle className={clash ? "plan-clash" : row.personId === null ? "plan-unassigned" : "plan-due"} cx={x(day) + step / 2} cy={middle} r={9} />
                    <text className={row.personId === null ? "plan-count dark" : "plan-count"} x={x(day) + step / 2} y={middle + 3.5} textAnchor="middle">{tasks.length}</text>
                  </g>
                );
              })}
              <text className="chart-tick" x={WIDTH - LATER / 2} y={middle + 4} textAnchor="middle">{row.later > 0 ? `+${row.later}` : "–"}</text>
            </g>
          );
        })}
        <line className="plan-line" x1={0} x2={WIDTH} y1={bottom} y2={bottom} />
      </svg>
      </div>
      <DocumentNotes insights={[...conflicts.map(conflictInsight), ...unassignedDue.map(unownedInsight)]}
        empty="Nobody is away when their work is due, and everything due in these two weeks has an owner." />
    </>
  );
}
