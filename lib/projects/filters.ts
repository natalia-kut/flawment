export type ProjectFilters = { query: string; status: string; showArchived: boolean };

export function filterProjects<T extends { name: string; description: string | null; status: string }>(
  projects: readonly T[], filters: ProjectFilters,
): T[] {
  const query = filters.query.trim().toLowerCase();
  return projects.filter((project) =>
    (!query || project.name.toLowerCase().includes(query) || (project.description ?? "").toLowerCase().includes(query)) &&
    (!filters.status || project.status === filters.status) &&
    (filters.showArchived || filters.status === "ARCHIVED" || project.status !== "ARCHIVED")
  );
}
