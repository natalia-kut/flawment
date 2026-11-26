import { addDays, daysBetween, isOpen, isOverdue } from "./engine";
import type { DocumentAbsence, DocumentProject, DocumentTask } from "./types";

/**
 * Days after today the plan covers. Colleagues only learn about time off this far
 * ahead (see relevantAbsences), so the plan never looks further.
 */
export const PLAN_DAYS = 14;

export type PlanRow = {
  /** Null for work nobody has taken. */
  personId: number | null;
  name: string;
  late: DocumentTask[];
  /** Open tasks by their deadline, for the days the plan covers. */
  due: Map<string, DocumentTask[]>;
  /** Open tasks due after the plan ends or without a deadline. */
  later: number;
  absences: DocumentAbsence[];
};

/** A task due while its person is away. */
export type PlanConflict = {
  task: DocumentTask; name: string; absence: DocumentAbsence;
  /** Their last working day before it, if any is left, and whether another deadline already falls on it. */
  lastDay: string | null; lastDayTaken: boolean;
};

export function isWeekend(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

const awayOn = (absences: DocumentAbsence[], day: string) => absences.find((absence) => absence.start <= day && day <= absence.end);

function lastWorkingDay(absences: DocumentAbsence[], today: string, deadline: string) {
  for (let day = deadline; day >= today; day = addDays(day, -1)) {
    if (!isWeekend(day) && !awayOn(absences, day)) return day;
  }
  return null;
}

/** Who has what due, day by day, against the days they are away. */
export function teamPlan(project: DocumentProject, today: string) {
  const days = Array.from({ length: PLAN_DAYS + 1 }, (_, index) => addDays(today, index));
  const lastDay = days[days.length - 1];
  const rows = new Map<number | null, PlanRow>();
  const addRow = (personId: number | null, name: string, absences: DocumentAbsence[]) => {
    const row: PlanRow = { personId, name, late: [], due: new Map(), later: 0, absences };
    rows.set(personId, row);
    return row;
  };
  for (const member of project.members) {
    addRow(member.person.id, member.person.name, member.absences.filter((absence) => absence.end >= today && absence.start <= lastDay));
  }

  const conflicts: PlanConflict[] = [];
  for (const task of project.tasks.filter(isOpen)) {
    // Someone who left the project can still hold a task; their time off is not ours to show.
    const row = rows.get(task.assignee?.id ?? null) ?? addRow(task.assignee?.id ?? null, task.assignee?.name ?? "Unassigned", []);
    if (isOverdue(task, today)) row.late.push(task);
    else if (!task.deadline || task.deadline > lastDay) row.later += 1;
    else {
      row.due.set(task.deadline, [...(row.due.get(task.deadline) ?? []), task]);
      const absence = awayOn(row.absences, task.deadline);
      if (absence) conflicts.push({ task, name: row.name, absence, lastDay: lastWorkingDay(row.absences, today, task.deadline), lastDayTaken: false });
    }
  }
  for (const conflict of conflicts) {
    conflict.lastDayTaken = conflict.lastDay !== null && rows.get(conflict.task.assignee!.id)!.due.has(conflict.lastDay);
  }

  const inPlan = (row: PlanRow) => row.late.length + [...row.due.values()].flat().length;
  return {
    days,
    // The busiest first; work without an owner closes the list.
    rows: [...rows.values()].sort((a, b) =>
      Number(a.personId === null) - Number(b.personId === null) || inPlan(b) - inPlan(a) || a.name.localeCompare(b.name)),
    conflicts: conflicts.sort((a, b) => daysBetween(b.task.deadline!, a.task.deadline!)),
  };
}
