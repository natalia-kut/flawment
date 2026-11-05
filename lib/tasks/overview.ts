import type { WorkspaceProject } from "@/lib/projects/data";
import { filterTasks, type TaskFilters } from "./filters";

export function getOverviewTasks(projects: readonly Pick<WorkspaceProject, "id" | "name" | "tasks">[]) {
  return projects.flatMap((project) => project.tasks.map((task) => ({
    ...task, projectId: project.id, projectName: project.name,
  })));
}

export function filterOverviewTasks<T extends ReturnType<typeof getOverviewTasks>[number]>(
  tasks: readonly T[], filters: TaskFilters, projectId: string,
): T[] {
  return filterTasks(
    projectId ? tasks.filter((task) => String(task.projectId) === projectId) : tasks,
    filters,
  );
}
