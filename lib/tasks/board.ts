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
  return { done, total: active.length, percent: active.length ? Math.round(done / active.length * 100) : 0 };
}
