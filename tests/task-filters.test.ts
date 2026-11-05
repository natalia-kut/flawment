import test from "node:test";
import assert from "node:assert/strict";
import { emptyTaskFilters, filterTasks, taskAssigneeKey } from "../lib/tasks/filters";

const tasks = [
  { id: 1, title: "Prepare Report", description: null, status: "TO_DO", priority: "HIGH", assignedTo: 7, assigneeName: "Alex Smith" },
  { id: 2, title: "Review design", description: "Check report charts", status: "IN_PROGRESS", priority: "LOW", assignedTo: null, assigneeName: "Unassigned" },
  { id: 3, title: "Prepare presentation", description: "Final slides", status: "TO_DO", priority: "HIGH", assignedTo: 8, assigneeName: "Alex Smith" },
  { id: 4, title: "Deployment", description: "Publish app", status: "COMPLETED", priority: "URGENT", assignedTo: null, assigneeName: "Administrator" },
];
const ids = (filters: Partial<typeof emptyTaskFilters>) =>
  filterTasks(tasks, { ...emptyTaskFilters, ...filters }).map((task) => task.id);

test("search matches title and description, ignores case and trims whitespace", () => {
  assert.deepEqual(ids({ query: " REPORT " }), [1, 2]);
  assert.deepEqual(ids({ query: "slides" }), [3]);
  assert.deepEqual(ids({ query: "   " }), [1, 2, 3, 4]);
  assert.deepEqual(ids({ query: "not present" }), []);
});

test("filters combine and distinguish assignees with the same name", () => {
  assert.deepEqual(ids({ status: "TO_DO", priority: "HIGH", assignee: "8", query: "prepare" }), [3]);
  assert.deepEqual(ids({ status: "COMPLETED" }), [4]);
  assert.deepEqual(ids({ priority: "LOW" }), [2]);
  assert.deepEqual(ids({ assignee: "unassigned" }), [2]);
  assert.deepEqual(ids({ assignee: "administrator" }), [4]);
  assert.deepEqual(ids({ status: "TO_DO", priority: "LOW" }), []);
  assert.equal(taskAssigneeKey(tasks[0]), "7");
});

test("clearing filters restores all tasks without modifying data or order", () => {
  const snapshot = structuredClone(tasks);
  assert.deepEqual(ids({}), [1, 2, 3, 4]);
  assert.deepEqual(tasks, snapshot);
  assert.deepEqual(filterTasks([], emptyTaskFilters), []);
});

test("stage filters combine with search and distinguish tasks without stages", () => {
  const staged = tasks.map((task) => ({ ...task, stageId: task.id === 1 ? 10 : null }));
  assert.deepEqual(filterTasks(staged, { ...emptyTaskFilters, stage: "10", query: "report" }).map((task) => task.id), [1]);
  assert.deepEqual(filterTasks(staged, { ...emptyTaskFilters, stage: "none" }).map((task) => task.id), [2, 3, 4]);
  assert.equal(filterTasks(staged, { ...emptyTaskFilters, stage: "999" }).length, 0);
});
