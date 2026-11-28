import test from "node:test";
import assert from "node:assert/strict";
import { boardColumns, isTaskOverdue, taskProgress } from "../lib/tasks/board";

test("overdue excludes completed and cancelled tasks and treats today as on time", () => {
  const today = "2026-10-26";
  assert.equal(isTaskOverdue({ deadline: "2026-10-25", status: "TO_DO" }, today), true);
  for (const status of ["COMPLETED", "CANCELLED"]) {
    assert.equal(isTaskOverdue({ deadline: "2026-10-25", status }, today), false);
  }
  for (const deadline of ["", "2026-10-26", "2026-10-27"]) {
    assert.equal(isTaskOverdue({ deadline, status: "IN_PROGRESS" }, today), false);
  }
});

test("progress excludes cancelled tasks and handles empty groups", () => {
  assert.deepEqual(taskProgress([{ status: "COMPLETED" }, { status: "TO_DO" }, { status: "CANCELLED" }]),
    { done: 1, total: 2, percent: 50, complete: false });
  assert.deepEqual(taskProgress([]), { done: 0, total: 0, percent: 0, complete: false });
  assert.deepEqual(taskProgress([{ status: "CANCELLED" }]), { done: 0, total: 0, percent: 0, complete: false });
  // 100% only when everything is done, 0% only when nothing is.
  const many = (done: number, open: number) => [...Array(done).fill({ status: "COMPLETED" }), ...Array(open).fill({ status: "TO_DO" })];
  assert.deepEqual(taskProgress(many(199, 1)), { done: 199, total: 200, percent: 99, complete: false });
  assert.deepEqual(taskProgress(many(1, 499)), { done: 1, total: 500, percent: 1, complete: false });
  assert.deepEqual(taskProgress(many(3, 0)), { done: 3, total: 3, percent: 100, complete: true });
  assert.deepEqual(boardColumns.map((column) => column.status), ["TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"]);
});
