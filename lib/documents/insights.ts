import { BEHIND_POINTS, daysBetween, formatShortDay, isHighPriority, isOpen, isOverdue, plural, projectPace } from "./engine";
import { stageRows } from "./stages";
import { teamPlan, type PlanConflict } from "./team-plan";
import type { DocumentAbsence, DocumentProject, DocumentTask } from "./types";

/** A sentence about the project: `subject` is set in bold, `text` follows it. */
export type Insight = { key: string; tone: "critical" | "warning" | "good"; subject: string; text: string };

const NOT_STARTED_DAYS = 7;
const DUE_DAYS = 14;

/** "A", "A and B", "A, B and 3 more". */
export function listTitles(tasks: DocumentTask[], shown = 2) {
  const titles = tasks.slice(0, shown).map((task) => `“${task.title}”`);
  const more = tasks.length - titles.length;
  if (more > 0) return `${titles.join(", ")} and ${more} more`;
  return titles.length > 1 ? `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}` : titles.join("");
}

export function formatAbsence({ start, end }: DocumentAbsence) {
  return start === end ? formatShortDay(start) : `${formatShortDay(start)} – ${formatShortDay(end)}`;
}

export function conflictInsight({ task, name, absence, lastDay, lastDayTaken }: PlanConflict): Insight {
  const advice = lastDay === null ? "No working days are left before it."
    : `Last working day before: ${formatShortDay(lastDay)}${lastDayTaken ? ", when they already have another deadline" : ""}.`;
  return {
    key: `conflict-${task.id}`, tone: "critical", subject: task.title,
    text: `is due ${formatShortDay(task.deadline!)}, while ${name} is away (${formatAbsence(absence)}). ${advice}`,
  };
}

export function unownedInsight(task: DocumentTask): Insight {
  return { key: `unowned-${task.id}`, tone: "warning", subject: task.title, text: `is due ${formatShortDay(task.deadline!)} and nobody has taken it.` };
}

const byDeadline = (a: DocumentTask, b: DocumentTask) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");

/** What needs attention in the project and why: the most serious first. */
export function projectInsights(project: DocumentProject, today: string): Insight[] {
  if (project.status === "COMPLETED" || project.status === "CANCELLED" || project.status === "ARCHIVED") {
    const left = project.tasks.filter(isOpen);
    return left.length === 0 ? [] : [{
      key: "left-open", tone: "warning", subject: `${plural(left.length, "task")} left open`,
      text: `although the project is over: ${listTitles(left)}.`,
    }];
  }

  const insights: Insight[] = [];
  const open = project.tasks.filter(isOpen).sort(byDeadline);
  const overdue = open.filter((task) => isOverdue(task, today));
  const inDays = (task: DocumentTask) => (task.deadline ? daysBetween(today, task.deadline) : Infinity);

  if (project.endDate && today > project.endDate && open.length > 0) {
    insights.push({ key: "past-end", tone: "critical", subject: "The project is past its end date",
      text: `(${formatShortDay(project.endDate)}) with ${plural(open.length, "task")} still open.` });
  }
  if (overdue.length > 0) {
    insights.push({ key: "overdue", tone: "critical", subject: `${plural(overdue.length, "task")} past the deadline:`,
      text: `${listTitles(overdue)}. ${overdue.length > 1 ? "The oldest is" : "It is"} ${plural(-inDays(overdue[0]), "day")} late.` });
  }
  // Unowned work has its own sentence below.
  const notStarted = open.filter((task) => task.assignee && task.status === "TO_DO" && isHighPriority(task) && inDays(task) >= 0 && inDays(task) <= NOT_STARTED_DAYS);
  for (const task of notStarted) {
    const days = inDays(task);
    insights.push({ key: `not-started-${task.id}`, tone: "critical", subject: task.title,
      text: `is ${task.priority === "URGENT" ? "urgent" : "high priority"}, due ${days === 0 ? "today" : `in ${plural(days, "day")}`} and not started yet.` });
  }
  insights.push(...teamPlan(project, today).conflicts.map(conflictInsight));

  const rows = stageRows(project, today);
  for (const { stage, state, label, tasks, done } of rows) {
    if (!stage || state !== "late") continue;
    insights.push({ key: `stage-late-${stage.id}`, tone: "critical", subject: `Stage “${stage.name}”`, text: `is ${label} with ${done} of ${plural(tasks.length, "task")} done.` });
  }

  const { progress, elapsed } = projectPace(project, today);
  if (elapsed !== null && progress < elapsed - BEHIND_POINTS && today <= project.endDate!) {
    insights.push({ key: "pace", tone: "warning", subject: "Work is behind the calendar:", text: `${elapsed}% of the time has passed and ${progress}% of the tasks are done.` });
  }
  for (const { stage, state, label, tasks, done, after } of rows) {
    if (!stage) continue;
    const little = state === "soon" && done * 2 < tasks.length;
    const later = `${listTitles(after)} ${after.length === 1 ? "is" : "are"} due only after it ends`;
    if (!little && after.length === 0) continue;
    insights.push({ key: `stage-${stage.id}`, tone: "warning", subject: `Stage “${stage.name}”`,
      text: little ? `is ${label.toLowerCase()} with ${done} of ${plural(tasks.length, "task")} done${after.length > 0 ? `, and ${later}` : ""}.`
        : `ends ${formatShortDay(stage.deadline!)}, but ${later}.` });
  }
  insights.push(...open.filter((task) => !task.assignee && inDays(task) >= 0 && inDays(task) <= DUE_DAYS).map(unownedInsight));

  const afterEnd = project.endDate ? open.filter((task) => task.deadline !== null && task.deadline > project.endDate!) : [];
  if (afterEnd.length > 0) {
    insights.push({ key: "after-end", tone: "warning", subject: `${plural(afterEnd.length, "task")} due after the project ends:`, text: `${listTitles(afterEnd)}.` });
  }
  const noDeadline = open.filter((task) => task.deadline === null);
  if (noDeadline.length > 0) {
    insights.push({ key: "no-deadline", tone: "warning", subject: `${plural(noDeadline.length, "open task")} without a deadline:`, text: `${listTitles(noDeadline)}.` });
  }
  return insights;
}
