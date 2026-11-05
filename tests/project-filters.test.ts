import test from "node:test";
import assert from "node:assert/strict";
import { filterProjects } from "../lib/projects/filters";
import { taskProgress } from "../lib/tasks/board";

const projects = [
  { id: 1, name: "Engineering", description: "Room booking", status: "IN_PROGRESS" },
  { id: 2, name: "Archive", description: null, status: "ARCHIVED" },
  { id: 3, name: "Research", description: "Engineering report", status: "TO_DO" },
];
const filter = (extra = {}) => filterProjects(projects, { query: "", status: "", showArchived: false, ...extra }).map((p) => p.id);

test("project search combines name, description and status without changing order", () => {
  assert.deepEqual(filter({ query: " ENGINEERING " }), [1, 3]);
  assert.deepEqual(filter({ query: "engineering", status: "TO_DO" }), [3]);
  assert.deepEqual(filter({ query: "not present" }), []);
  assert.deepEqual(projects.map((p) => p.id), [1, 2, 3]);
});

test("archived projects are hidden by default and available explicitly", () => {
  assert.deepEqual(filter(), [1, 3]);
  assert.deepEqual(filter({ showArchived: true }), [1, 2, 3]);
  assert.deepEqual(filter({ status: "ARCHIVED" }), [2]);
  assert.deepEqual(filterProjects([], { query: "", status: "", showArchived: false }), []);
});

test("project progress counts completed tasks and excludes cancelled tasks", () => {
  assert.deepEqual(taskProgress([{ status: "COMPLETED" }, { status: "IN_PROGRESS" }, { status: "CANCELLED" }]),
    { done: 1, total: 2, percent: 50 });
  assert.equal(taskProgress([]).percent, 0);
});
