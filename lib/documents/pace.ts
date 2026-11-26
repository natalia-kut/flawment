import { addDays, daysBetween, isOpen } from "./engine";
import type { DocumentProject } from "./types";

/** The forecast looks at this much recent work, and needs at least this much of it to mean anything. */
const WINDOW_DAYS = 28;
const MIN_WINDOW_DAYS = 7;
const MIN_COMPLETED = 3;

export type PacePoint = { day: string; scope: number; done: number | null };

export type Forecast =
  | { state: "finished" }
  | { state: "unknown" }
  | { state: "expected"; day: string; completed: number; days: number };

/**
 * The project's work over time: how many tasks it had and how many were done.
 * Tasks finished before completion dates were recorded have none, so `done` is only
 * known from the first recorded date on. Cancelled tasks do not count.
 */
export function projectHistory(project: DocumentProject, today: string) {
  const tasks = project.tasks.filter((task) => task.status !== "CANCELLED");
  const undated = tasks.filter((task) => task.status === "COMPLETED" && task.completedOn === null).length;
  const recorded = tasks.map((task) => task.completedOn).filter((day): day is string => day !== null).sort();
  const start = [project.startDate, ...recorded, today].sort()[0];
  const knownFrom = undated === 0 ? start : recorded[0] ?? today;

  const points: PacePoint[] = [];
  for (let day = start; day <= today; day = addDays(day, 1)) {
    points.push({
      day,
      scope: tasks.filter((task) => task.createdOn <= day).length,
      done: day < knownFrom ? null : undated + recorded.filter((completed) => completed <= day).length,
    });
  }

  const open = tasks.filter(isOpen).length;
  let forecast: Forecast = { state: "unknown" };
  if (tasks.length > 0 && open === 0) forecast = { state: "finished" };
  else {
    const from = [addDays(today, -(WINDOW_DAYS - 1)), knownFrom].sort().at(-1)!;
    const days = daysBetween(from, today) + 1;
    const completed = recorded.filter((day) => day >= from && day <= today).length;
    if (days >= MIN_WINDOW_DAYS && completed >= MIN_COMPLETED) {
      forecast = { state: "expected", day: addDays(today, Math.ceil((open * days) / completed)), completed, days };
    }
  }
  return { points, undated, open, forecast };
}
