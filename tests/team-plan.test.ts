import test from "node:test";
import assert from "node:assert/strict";
import { teamPlan } from "../lib/documents/team-plan";
import type { DocumentAbsence, DocumentProject, DocumentTask } from "../lib/documents/types";

// A Wednesday.
const today = "2026-11-25";
const person = (id: number, name: string) => ({ id, name, email: "", username: "" });
const anna = person(1, "Anna"), jan = person(2, "Jan");

function project(tasks: Partial<DocumentTask>[], absences: DocumentAbsence[] = []): DocumentProject {
  return {
    id: 1, name: "Project", description: null, status: "IN_PROGRESS", startDate: "2026-11-01", endDate: null, owner: anna, stages: [],
    members: [
      { person: anna, role: "OWNER", joinedAt: "2026-11-01", absences: [] },
      { person: jan, role: "CONTRIBUTOR", joinedAt: "2026-11-01", absences },
    ],
    tasks: tasks.map((task, index) => ({
      id: index + 1, title: `Task ${index + 1}`, description: null, status: "TO_DO", priority: "MEDIUM",
      deadline: null, assignee: jan, creator: anna, stage: null, ...task,
    })),
  };
}

test("the plan sorts open work into late, the next 14 days and later", () => {
  const { days, rows } = teamPlan(project([
    { deadline: "2026-11-24" }, { deadline: "2026-11-25" }, { deadline: "2026-12-09" }, { deadline: "2026-12-10" }, { deadline: null },
    { deadline: "2026-11-26", status: "COMPLETED" },
  ]), today);
  assert.equal(days[0], today);
  assert.equal(days.at(-1), "2026-12-09");
  const row = rows.find((r) => r.name === "Jan")!;
  assert.equal(row.late.length, 1);
  assert.deepEqual([...row.due.keys()], ["2026-11-25", "2026-12-09"]);
  assert.equal(row.later, 2);
});

test("a task due while its person is away is a conflict, with their last working day", () => {
  // Away Monday to Wednesday: the last working day before is the Friday.
  const { conflicts } = teamPlan(project([{ deadline: "2026-12-01" }, { deadline: "2026-12-03" }], [{ start: "2026-11-30", end: "2026-12-02" }]), today);
  assert.deepEqual(conflicts.map((c) => [c.task.id, c.lastDay]), [[1, "2026-11-27"]]);
});

test("a last working day that already has a deadline says so", () => {
  const { conflicts } = teamPlan(project([{ deadline: "2026-12-01" }, { deadline: "2026-11-27" }], [{ start: "2026-11-30", end: "2026-12-02" }]), today);
  assert.equal(conflicts[0].lastDayTaken, true);
});

test("a conflict can leave no working days at all", () => {
  const { conflicts } = teamPlan(project([{ deadline: "2026-11-27" }], [{ start: "2026-11-20", end: "2026-11-30" }]), today);
  assert.equal(conflicts[0].lastDay, null);
});

test("unowned work closes the list, and someone who left the project keeps a row", () => {
  const { rows } = teamPlan(project([
    { assignee: null, deadline: "2026-11-26" }, { assignee: null, deadline: "2026-11-27" }, { assignee: person(9, "Former"), deadline: "2026-11-26" },
  ]), today);
  assert.deepEqual(rows.map((r) => r.name), ["Former", "Anna", "Jan", "Unassigned"]);
});
