import { sharePercent } from "@/lib/percent";

export const boardColumns = [
  { status: "TO_DO", label: "TO DO" },
  { status: "IN_PROGRESS", label: "IN PROGRESS" },
  { status: "IN_REVIEW", label: "TO REVIEW" },
  { status: "COMPLETED", label: "DONE" },
  { status: "CANCELLED", label: "CANCELLED" },
] as const;

export function isTaskOverdue(task: { deadline: string; status: string }, today: string) {
  return !!task.deadline && task.deadline < today &&
    task.status !== "COMPLETED" && task.status !== "CANCELLED";
}

/** Sunday of the calendar week (Monday to Sunday, like the dashboard calendar) that `today` falls in. */
export function endOfWeek(today: string) {
  const day = new Date(today + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + 6 - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}

/** Open, and due from today to Sunday. Earlier deadlines are overdue, not due. */
export function isDueThisWeek(task: { deadline: string; status: string }, today: string) {
  return !!task.deadline && task.deadline >= today && task.deadline <= endOfWeek(today) &&
    task.status !== "COMPLETED" && task.status !== "CANCELLED";
}

export function taskProgress(tasks: readonly { status: string }[]) {
  const active = tasks.filter((task) => task.status !== "CANCELLED");
  const done = active.filter((task) => task.status === "COMPLETED").length;
  // `complete` is the test for "all done": a rounded percent can read 100 with work still open.
  return { done, total: active.length, percent: sharePercent(done, active.length), complete: active.length > 0 && done === active.length };
}
