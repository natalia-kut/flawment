import { addDays } from "./engine";
import type { DocumentProject, DocumentTask } from "./types";

/** How far back a document can look: comments older than this are not read at all. */
export const MAX_ACTIVITY_DAYS = 30;

const newestFirst = <T>(day: (item: T) => string) => (a: T, b: T) => day(b).localeCompare(day(a));

/** What happened in the project in the last `days` days, today included. */
export function projectActivity(project: DocumentProject, today: string, days: number) {
  const since = addDays(today, -(days - 1));
  const recent = (day: string | null): day is string => day !== null && day >= since && day <= today;
  return {
    completed: project.tasks.filter((task) => recent(task.completedOn)).sort(newestFirst<DocumentTask>((task) => task.completedOn!)),
    added: project.tasks.filter((task) => recent(task.createdOn)).sort(newestFirst<DocumentTask>((task) => task.createdOn)),
    discussed: project.tasks.map((task) => ({ task, comments: task.commentDays.filter(recent).length }))
      .filter((item) => item.comments > 0).sort((a, b) => b.comments - a.comments),
    files: project.tasks.flatMap((task) => task.files.filter((file) => recent(file.addedOn)).map((file) => ({ ...file, task })))
      .sort(newestFirst((file) => file.addedOn)),
  };
}

/** Every file attached to the project's tasks, the newest first. */
export function projectFiles(project: DocumentProject) {
  return project.tasks.flatMap((task) => task.files.map((file) => ({ ...file, task }))).sort(newestFirst((file) => file.addedOn));
}
