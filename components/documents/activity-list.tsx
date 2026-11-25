import type { ReactNode } from "react";
import { projectActivity } from "@/lib/documents/activity";
import { formatShortDay, plural } from "@/lib/documents/engine";
import type { DocumentProject } from "@/lib/documents/types";

/** Longer lists end with "and 4 more": this is a summary, not a log. */
const SHOWN = 8;

type Entry = { key: string; title: string; detail: string };

function Group({ title, entries }: { title: string; entries: Entry[] }): ReactNode {
  if (entries.length === 0) return null;
  return (
    <section className="activity-group">
      <h4>{title} <span>{entries.length}</span></h4>
      <ul>
        {entries.slice(0, SHOWN).map((entry) => <li key={entry.key}><strong>{entry.title}</strong> <span>{entry.detail}</span></li>)}
        {entries.length > SHOWN && <li><span>and {entries.length - SHOWN} more</span></li>}
      </ul>
    </section>
  );
}

/** What was finished, added, discussed and attached lately. Never what was said. */
export default function ActivityList({ project, today, days }: { project: DocumentProject; today: string; days: number }) {
  const { completed, added, discussed, files } = projectActivity(project, today, days);
  if (completed.length + added.length + discussed.length + files.length === 0) {
    return <p className="document-muted">Nothing happened in the last {days} days.</p>;
  }
  return (
    <div className="activity">
      <Group title="Completed" entries={completed.map((task) => ({
        key: String(task.id), title: task.title, detail: [task.assignee?.name, formatShortDay(task.completedOn!)].filter(Boolean).join(" · "),
      }))} />
      <Group title="Added" entries={added.map((task) => ({
        key: String(task.id), title: task.title, detail: `${task.assignee?.name ?? "Unassigned"} · ${task.deadline ? "due " + formatShortDay(task.deadline) : "no deadline"}`,
      }))} />
      <Group title="Discussed" entries={discussed.map(({ task, comments }) => ({ key: String(task.id), title: task.title, detail: plural(comments, "comment") }))} />
      <Group title="New files" entries={files.map((file) => ({ key: String(file.id), title: file.name, detail: `${file.task.title} · ${formatShortDay(file.addedOn)}` }))} />
    </div>
  );
}
