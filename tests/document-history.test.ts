import test from "node:test";
import assert from "node:assert/strict";
import { projectActivity } from "../lib/documents/activity";
import { projectHistory } from "../lib/documents/pace";
import { parseBlocks } from "../lib/documents/template-schema";
import type { DocumentProject, DocumentTask } from "../lib/documents/types";

const today = "2026-11-25";
const anna = { id: 1, name: "Anna", email: "", username: "" };

function project(tasks: Partial<DocumentTask>[], fields: Partial<DocumentProject> = {}): DocumentProject {
  return {
    id: 1, name: "Project", description: null, status: "IN_PROGRESS", startDate: "2026-11-01", endDate: "2026-12-31", owner: anna, stages: [], members: [],
    tasks: tasks.map((task, index) => ({
      id: index + 1, title: `Task ${index + 1}`, description: null, status: "TO_DO", priority: "MEDIUM", deadline: null, assignee: anna, creator: anna, stage: null,
      createdOn: "2026-11-01", completedOn: null, commentDays: [], files: [], ...task,
    })),
    ...fields,
  };
}
const done = (completedOn: string | null): Partial<DocumentTask> => ({ status: "COMPLETED", completedOn });

test("activity covers the last days, today included, and nothing older", () => {
  const activity = projectActivity(project([
    done("2026-11-19"), done("2026-11-18"), done(today), { createdOn: "2026-11-20" },
    { commentDays: ["2026-11-10", "2026-11-24", "2026-11-25"] },
    { files: [{ id: 1, name: "new.pdf", addedOn: "2026-11-24" }, { id: 2, name: "old.pdf", addedOn: "2026-11-02" }] },
  ]), today, 7);
  assert.deepEqual(activity.completed.map((task) => task.id), [3, 1]);
  assert.deepEqual(activity.added.map((task) => task.id), [4]);
  assert.deepEqual(activity.discussed.map((item) => [item.task.id, item.comments]), [[5, 2]]);
  assert.deepEqual(activity.files.map((file) => file.name), ["new.pdf"]);
});

test("history counts scope by creation and done by completion, without cancelled tasks", () => {
  const { points } = projectHistory(project([done("2026-11-10"), { createdOn: "2026-11-20" }, { status: "CANCELLED" }]), today);
  const at = (day: string) => points.find((point) => point.day === day)!;
  assert.deepEqual(at("2026-11-09"), { day: "2026-11-09", scope: 1, done: 0 });
  assert.deepEqual(at("2026-11-10"), { day: "2026-11-10", scope: 1, done: 1 });
  assert.deepEqual(points.at(-1), { day: today, scope: 2, done: 1 });
});

test("progress before completion dates were recorded is unknown, not zero", () => {
  const { points, undated } = projectHistory(project([done(null), done("2026-11-20"), {}]), today);
  assert.equal(undated, 1);
  assert.equal(points.find((point) => point.day === "2026-11-19")!.done, null);
  assert.equal(points.find((point) => point.day === "2026-11-20")!.done, 2);
});

test("the forecast follows the recent pace", () => {
  // 5 of 10 tasks in 25 days: the other 5 take another 25.
  const { forecast } = projectHistory(project([
    ...["2026-11-03", "2026-11-08", "2026-11-13", "2026-11-18", "2026-11-23"].map(done), {}, {}, {}, {}, {},
  ]), today);
  assert.deepEqual(forecast, { state: "expected", day: "2026-12-20", completed: 5, days: 25 });
});

test("too little recent work gives no forecast, and finished work needs none", () => {
  assert.equal(projectHistory(project([done("2026-11-03"), done("2026-11-04"), {}]), today).forecast.state, "unknown");
  assert.equal(projectHistory(project([done(null), done("2026-11-23"), done("2026-11-24"), done("2026-11-25"), {}]), today).forecast.state, "unknown");
  assert.equal(projectHistory(project([done(null)]), today).forecast.state, "finished");
});

test("an activity block accepts only the offered periods", () => {
  assert.deepEqual(parseBlocks([{ id: "a", type: "activity", title: "Lately", days: 14 }, { id: "b", type: "activity", title: "Lately", days: 9999 }]), [
    { id: "a", type: "activity", title: "Lately", days: 14 }, { id: "b", type: "activity", title: "Lately", days: 7 },
  ]);
});
