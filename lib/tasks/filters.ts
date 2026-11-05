export type TaskFilters = {
  query: string;
  status: string;
  priority: string;
  assignee: string;
  stage: string;
};

type FilterableTask = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: number | null;
  assigneeName: string;
  stageId?: number | null;
};

export const emptyTaskFilters: TaskFilters = {
  query: "", status: "", priority: "", assignee: "", stage: "",
};

export function taskAssigneeKey(task: Pick<FilterableTask, "assignedTo" | "assigneeName">) {
  if (task.assignedTo !== null) return String(task.assignedTo);
  return task.assigneeName === "Unassigned" ? "unassigned" : "administrator";
}

export function filterTasks<T extends FilterableTask>(tasks: readonly T[], filters: TaskFilters): T[] {
  const query = filters.query.trim().toLowerCase();
  return tasks.filter((task) =>
    (!query || task.title.toLowerCase().includes(query) ||
      (task.description ?? "").toLowerCase().includes(query)) &&
    (!filters.status || task.status === filters.status) &&
    (!filters.priority || task.priority === filters.priority) &&
    (!filters.assignee || taskAssigneeKey(task) === filters.assignee) &&
    (!filters.stage || (filters.stage === "none" ? task.stageId == null : String(task.stageId) === filters.stage))
  );
}
