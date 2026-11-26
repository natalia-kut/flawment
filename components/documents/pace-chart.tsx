import { addDays, daysBetween, formatDay, plural } from "@/lib/documents/engine";
import { projectHistory, type Forecast } from "@/lib/documents/pace";
import { formatMonthTick } from "@/lib/time-off/dates";
import type { DocumentProject } from "@/lib/documents/types";

const WIDTH = 640, LEFT = 26, RIGHT = 10, TOP = 22, HEIGHT = 150;
const BASE = TOP + HEIGHT;
/** A forecast far past the end would squeeze everything else: the line leaves the chart instead. */
const MAX_DAYS_PAST_END = 45;
const MAX_MONTHS = 8;


function verdict(forecast: Forecast, open: number, endDate: string | null) {
  if (forecast.state === "finished") return "All work is done.";
  if (forecast.state === "unknown") return "There are too few recent completions on record to forecast when the work will be done.";
  const pace = `At the pace of the last ${plural(forecast.days, "day")} (${plural(forecast.completed, "task")} done), the ${plural(open, "open task")} would be finished around ${formatDay(forecast.day)}`;
  if (!endDate) return pace + ".";
  const late = daysBetween(endDate, forecast.day);
  if (late > 0) return `${pace}, ${plural(late, "day")} after the project ends.`;
  return late === 0 ? `${pace}, on the day the project ends.` : `${pace}, ${plural(-late, "day")} before the project ends.`;
}

/** All the work against the work done, day by day, and where the current pace leads. */
export default function PaceChart({ project, today }: { project: DocumentProject; today: string }) {
  const { points, undated, open, forecast } = projectHistory(project, today);
  const last = points.at(-1)!;
  if (last.scope === 0) return <p className="document-muted">This project has no tasks yet.</p>;

  const first = points[0].day;
  const expected = forecast.state === "expected" ? forecast.day : null;
  const end = [project.endDate ?? today, today].sort().at(-1)!;
  const limit = addDays(end, MAX_DAYS_PAST_END);
  const to = expected && expected > end ? (expected < limit ? expected : limit) : end;
  const total = Math.max(daysBetween(first, to), 1);
  const max = Math.max(...points.map((point) => point.scope), 1);
  const x = (day: string) => LEFT + (daysBetween(first, day) / total) * (WIDTH - LEFT - RIGHT);
  const y = (count: number) => BASE - (count / max) * HEIGHT;

  const known = points.filter((point): point is typeof point & { done: number } => point.done !== null);
  const steps = (values: { day: string; value: number }[]) =>
    values.map(({ day, value }, index) => (index === 0 ? `M${x(day)} ${y(value)}` : `H${x(day)}V${y(value)}`)).join("");
  const done = steps(known.map(({ day, done }) => ({ day, value: done })));
  const ends = project.endDate && project.endDate >= first ? project.endDate : null;

  // Where the forecast line leaves the chart, when it does.
  const shown = expected && expected > to ? to : expected;
  const reached = expected && shown ? last.done! + open * (daysBetween(today, shown) / daysBetween(today, expected)) : 0;

  const months: string[] = [];
  const cursor = new Date(`${first.slice(0, 7)}-01T00:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.toISOString().slice(0, 10) <= to) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const step = Math.ceil(months.length / MAX_MONTHS);

  return (
    <>
      <ul className="chart-legend">
        <li><span className="chart-swatch swatch-pace-scope" aria-hidden="true" />All tasks</li>
        <li><span className="chart-swatch swatch-completed" aria-hidden="true" />Done</li>
        {expected && <li><span className="chart-swatch swatch-pace-forecast" aria-hidden="true" />At the current pace</li>}
      </ul>
      <svg className="chart" viewBox={`0 0 ${WIDTH} ${BASE + 24}`} role="img"
        aria-label={`${last.done ?? 0} of ${last.scope} tasks done. ${verdict(forecast, open, project.endDate)}`}>
        {[0, Math.round(max / 2), max].filter((value, index, all) => all.indexOf(value) === index).map((value) => (
          <g key={value}>
            <line className="pace-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} />
            <text className="chart-tick" x={LEFT - 6} y={y(value) + 3.5} textAnchor="end">{value}</text>
          </g>
        ))}
        {months.filter((_, index) => index % step === 0).map((month, index) => (
          <text key={month} className="chart-tick" x={x(month)} y={BASE + 16} textAnchor="middle">{formatMonthTick(month, index === 0)}</text>
        ))}

        {done && <path className="pace-area" d={`${done}V${BASE}H${x(known[0].day)}Z`} />}
        <path className="pace-scope" d={steps(points.map(({ day, scope }) => ({ day, value: scope })))} />
        {done && <path className="pace-done" d={done} />}
        <circle className="pace-now" cx={x(today)} cy={y(last.done!)} r={4}><title>{`${last.done} done today`}</title></circle>
        {expected && shown && <line className="pace-forecast" x1={x(today)} y1={y(last.done!)} x2={x(shown)} y2={y(reached)} />}
        {expected && expected <= to && <circle className="pace-forecast-end" cx={x(expected)} cy={y(last.scope)} r={4} />}

        {ends && <>
          <line className="pace-end" x1={x(ends)} x2={x(ends)} y1={TOP - 4} y2={BASE} />
          <text className="chart-tick" x={x(ends)} y={TOP - 9} textAnchor={x(ends) > WIDTH - 60 ? "end" : "middle"}>End of project</text>
        </>}
        <line className="chart-today" x1={x(today)} x2={x(today)} y1={TOP - 4} y2={BASE} />
        {(!ends || Math.abs(x(ends) - x(today)) > 80) && <text className="chart-today-label" x={x(today)} y={TOP - 9} textAnchor="middle">Today</text>}
      </svg>
      <p className="chart-caption">
        {verdict(forecast, open, project.endDate)}
        {undated > 0 && ` ${plural(undated, "task")} ${undated === 1 ? "was" : "were"} done before completion dates were recorded, so earlier progress is not drawn.`}
      </p>
    </>
  );
}
