import { daysBetween, isOpen, plural } from "./engine";
import type { DocumentProject, DocumentStage, DocumentTask } from "./types";

export type StageState = "done" | "late" | "soon" | "open" | "empty";

export type StageRow = {
  /** Null for the tasks outside any stage. */
  stage: DocumentStage | null;
  /** Cancelled tasks do not count towards a stage. */
  tasks: DocumentTask[];
  done: number;
  state: StageState;
  /** "Done", "3 days late", "Due in 5 days"… */
  label: string;
  /** Open tasks due only after the stage itself. */
  after: DocumentTask[];
};

const SOON_DAYS = 14;

function describe(deadline: string | null, total: number, open: number, cancelled: number, today: string): { state: StageState; label: string } {
  if (total > 0 && open === 0) return { state: "done", label: "Done" };
  const days = deadline ? daysBetween(today, deadline) : null;
  // A stage with nothing left to count is still late (or due) by its own deadline.
  if (total === 0 && (days === null || days > SOON_DAYS)) return { state: "empty", label: cancelled > 0 ? "All tasks cancelled" : "No tasks yet" };
  if (days === null) return { state: "open", label: "No deadline" };
  if (days < 0) return { state: "late", label: `${plural(-days, "day")} late` };
  return { state: days <= SOON_DAYS ? "soon" : "open", label: days === 0 ? "Due today" : `Due in ${plural(days, "day")}` };
}

/** How far each stage is, in the order of their deadlines; tasks outside any stage come last. */
export function stageRows(project: DocumentProject, today: string): StageRow[] {
  const row = (stage: DocumentStage | null): StageRow => {
    const all = project.tasks.filter((task) => (task.stage?.id ?? null) === (stage?.id ?? null));
    const tasks = all.filter((task) => task.status !== "CANCELLED");
    const open = tasks.filter(isOpen);
    const deadline = stage?.deadline ?? null;
    return {
      stage, tasks, done: tasks.length - open.length,
      ...describe(deadline, tasks.length, open.length, all.length - tasks.length, today),
      after: deadline ? open.filter((task) => task.deadline !== null && task.deadline > deadline) : [],
    };
  };
  const stages = [...project.stages].sort((a, b) =>
    (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31") || a.id - b.id);
  const rest = row(null);
  return [...stages.map(row), ...(rest.tasks.length > 0 ? [{ ...rest, label: rest.state === "done" ? "Done" : "Outside any stage" }] : [])];
}
