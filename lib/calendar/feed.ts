import { prisma } from "@/lib/prisma";
import { visibleProjects, type Actor } from "@/lib/rbac";
import { getCalendarTimeOff } from "@/lib/time-off/calendar";
import { absenceTypeLabels } from "@/lib/time-off/labels";
import { addDays } from "@/lib/time-off/dates";
import { taskPriorityLabels } from "@/lib/tasks/labels";
import type { CalendarEvent } from "./ics";

/** Like the dashboard calendar: a couple of months back and about a year ahead. */
const BACK_DAYS = 62, AHEAD_DAYS = 400;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * What a person's calendar feed shows: the deadlines of their open tasks, when
 * their active projects end, and time off as the dashboard calendar shows it
 * (their own, and their team's when they lead it; never a note). Nothing here
 * goes beyond what they see in the app.
 */
export async function calendarEvents(actor: Actor, today: string, origin: string): Promise<CalendarEvent[]> {
  const host = new URL(origin).host;
  const window = { gte: new Date(addDays(today, -BACK_DAYS)), lte: new Date(addDays(today, AHEAD_DAYS)) };

  const [tasks, projects, timeOff] = await Promise.all([
    prisma.task.findMany({
      where: {
        assigned_to: actor.id, deadline: window, status: { notIn: ["COMPLETED", "CANCELLED"] },
        project: visibleProjects(actor),
      },
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
      select: { id: true, title: true, deadline: true, priority: true, project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { ...visibleProjects(actor), end_date: window, status: { in: ["TO_DO", "IN_PROGRESS"] } },
      orderBy: [{ end_date: "asc" }, { id: "asc" }],
      select: { id: true, name: true, end_date: true },
    }),
    getCalendarTimeOff(actor, today),
  ]);

  return [
    ...tasks.map((task): CalendarEvent => ({
      uid: `task-${task.id}@${host}`,
      summary: `Due: ${task.title}`,
      description: `${task.project.name} · ${taskPriorityLabels[task.priority]} priority`,
      url: `${origin}/?task=${task.id}`,
      start: isoDay(task.deadline!), end: isoDay(task.deadline!),
      categories: ["Deadline"],
    })),
    ...projects.map((project): CalendarEvent => ({
      uid: `project-end-${project.id}@${host}`,
      summary: `Project ends: ${project.name}`,
      url: `${origin}/?project=${project.id}`,
      start: isoDay(project.end_date!), end: isoDay(project.end_date!),
      categories: ["Project"],
    })),
    ...timeOff.map((absence): CalendarEvent => ({
      uid: `time-off-${absence.id}@${host}`,
      summary: absence.mine ? absenceTypeLabels[absence.type] : `${absence.name}: ${absenceTypeLabels[absence.type]}`,
      url: `${origin}/?view=time-off`,
      start: absence.start, end: absence.end,
      // Your own time off blocks your day; a teammate's does not.
      busy: absence.mine,
      categories: ["Time off"],
    })),
  ];
}
