import test from "node:test";
import assert from "node:assert/strict";
import { projectInsights } from "../lib/documents/insights";
import { stageRows } from "../lib/documents/stages";
import { parseBlocks } from "../lib/documents/template-schema";
import type { DocumentProject, DocumentStage, DocumentTask } from "../lib/documents/types";

const today = "2026-11-25";
const anna = { id: 1, name: "Anna", email: "", username: "" };
const build: DocumentStage = { id: 1, name: "Build", deadline: "2026-12-01" };
const launch: DocumentStage = { id: 2, name: "Launch", deadline: "2026-11-20" };

function project(tasks: Partial<DocumentTask>[], fields: Partial<DocumentProject> = {}): DocumentProject {
  return {
    id: 1, name: "Project", description: null, status: "IN_PROGRESS", startDate: "2026-11-01", endDate: null, owner: anna, stages: [],
    members: [{ person: anna, role: "OWNER", joinedAt: "2026-11-01", absences: [] }],
    tasks: tasks.map((task, index) => ({
      id: index + 1, title: `Task ${index + 1}`, description: null, status: "TO_DO", priority: "MEDIUM",
      deadline: "2027-01-10", assignee: anna, creator: anna, stage: null, ...task,
    })),
    ...fields,
  };
}
const keys = (p: DocumentProject) => projectInsights(p, today).map((insight) => insight.key);

test("a calm project needs no attention", () => {
  assert.deepEqual(keys(project([{}, { status: "COMPLETED", deadline: "2026-11-10" }])), []);
});

test("late work comes first and names the tasks", () => {
  const [first] = projectInsights(project([{ deadline: "2026-11-20" }, { deadline: "2026-11-24" }, { deadline: null }]), today);
  assert.equal(first.subject, "2 tasks past the deadline:");
  assert.equal(first.text, "“Task 1” and “Task 2”. The oldest is 5 days late.");
});

test("urgent work not started, work without an owner, deadline or after the end are each their own finding", () => {
  assert.deepEqual(keys(project([
    { priority: "URGENT", deadline: "2026-11-28" },
    { assignee: null, deadline: "2026-12-03" },
    { deadline: null },
    { deadline: "2027-02-01" },
  ], { startDate: "2026-11-20", endDate: "2027-01-31" })), ["not-started-1", "unowned-2", "after-end", "no-deadline"]);
});

test("urgent work nobody has taken is named once", () => {
  assert.deepEqual(keys(project([{ priority: "URGENT", assignee: null, deadline: "2026-11-28" }])), ["unowned-1"]);
});

test("a finished project only mentions work left open", () => {
  assert.deepEqual(keys(project([{ deadline: "2026-11-01" }], { status: "COMPLETED" })), ["left-open"]);
  assert.deepEqual(keys(project([{ status: "COMPLETED" }], { status: "COMPLETED" })), []);
});

test("stages follow their deadlines, skip cancelled tasks and end with tasks outside any stage", () => {
  const rows = stageRows(project([
    { stage: build, status: "COMPLETED" }, { stage: build, deadline: "2026-12-05" }, { stage: build, status: "CANCELLED" },
    { stage: launch }, {},
  ], { stages: [build, launch] }), today);
  assert.deepEqual(rows.map((r) => [r.stage?.name ?? null, r.done, r.tasks.length, r.state, r.label]), [
    ["Launch", 0, 1, "late", "5 days late"],
    ["Build", 1, 2, "soon", "Due in 6 days"],
    [null, 0, 1, "open", "Outside any stage"],
  ]);
  assert.deepEqual(rows[1].after.map((task) => task.id), [2]);
});

test("stage findings: late, almost due with little done, and tasks due after the stage", () => {
  assert.deepEqual(keys(project([{ stage: launch, deadline: null }, { stage: build, deadline: "2026-12-05" }], { stages: [build, launch] })),
    ["stage-late-2", "stage-1", "no-deadline"]);
});

test("an empty stage is neither done nor late", () => {
  assert.equal(stageRows(project([], { stages: [launch] }), today)[0].state, "empty");
});

test("charts that were removed turn into what replaced them", () => {
  const blocks = parseBlocks([
    { id: "a", type: "chart", kind: "workload", title: "Open work per person" },
    { id: "b", type: "chart", kind: "progressVsTime", title: "Progress vs. time elapsed" },
    { id: "c", type: "chart", kind: "priorityMatrix", title: "Our own title" },
    { id: "d", type: "chart", kind: "timeline", title: "Deadline timeline" },
  ]);
  assert.deepEqual(blocks, [
    { id: "a", type: "chart", kind: "teamPlan", title: "Team plan (next two weeks)" },
    // The same findings twice would only repeat themselves.
    { id: "b", type: "insights", title: "What needs attention" },
    { id: "d", type: "chart", kind: "timeline", title: "Deadline timeline" },
  ]);
});
