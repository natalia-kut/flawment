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

export function taskProgress(tasks: readonly { status: string }[]) {
  const active = tasks.filter((task) => task.status !== "CANCELLED");
  const done = active.filter((task) => task.status === "COMPLETED").length;
  // `complete` is the test for "all done": a rounded percent can read 100 with work still open.
  return { done, total: active.length, percent: sharePercent(done, active.length), complete: active.length > 0 && done === active.length };
}
