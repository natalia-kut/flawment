import test from "node:test";
import assert from "node:assert/strict";
import { getOverviewTasks, filterOverviewTasks } from "../lib/tasks/overview";
import { emptyTaskFilters } from "../lib/tasks/filters";

const task = (id: number, title: string, status: "TO_DO" | "COMPLETED") => ({
  id, title, status, canChangeStatus: true, description: null, priority: "MEDIUM" as const,
  assignedTo: null, assigneeName: "Unassigned", deadline: "",
});
const projects = [
  { id: 1, name: "First project", tasks: [task(10, "Write report", "TO_DO")] },
  { id: 2, name: "Second project", tasks: [task(20, "Review report", "COMPLETED")] },
  { id: 3, name: "Empty project", tasks: [] },
];

test("overview retains task identity and originating project without mutating data", () => {
  const snapshot = structuredClone(projects);
  const tasks = getOverviewTasks(projects);
  assert.deepEqual(tasks.map((item) => [item.id, item.projectId, item.projectName]),
    [[10, 1, "First project"], [20, 2, "Second project"]]);
  assert.deepEqual(projects, snapshot);
  assert.deepEqual(getOverviewTasks([]), []);
});

test("project filter combines with task filters and supports empty projects", () => {
  const tasks = getOverviewTasks(projects);
  assert.deepEqual(filterOverviewTasks(tasks, emptyTaskFilters, "2").map((item) => item.id), [20]);
  assert.equal(filterOverviewTasks(tasks, { ...emptyTaskFilters, status: "TO_DO" }, "2").length, 0);
  assert.equal(filterOverviewTasks(tasks, { ...emptyTaskFilters, query: "REPORT" }, "").length, 2);
  assert.equal(filterOverviewTasks(tasks, emptyTaskFilters, "3").length, 0);
  assert.equal(filterOverviewTasks(tasks, emptyTaskFilters, "").length, 2);
});

test("overview only aggregates the projects supplied by the authorized loader", () => {
  const tasks = getOverviewTasks(projects.slice(0, 1));
  assert.deepEqual(tasks.map((item) => item.projectId), [1]);
  assert.equal(filterOverviewTasks(tasks, emptyTaskFilters, "2").length, 0);
});
