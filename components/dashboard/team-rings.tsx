"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard-widgets.module.css";

export type TeamTask = { status: string; overdue: boolean; assigneeKey: string; assigneeName: string };

const R = 26;
const C = 2 * Math.PI * R;
const MAX_PEOPLE = 8;

type Person = { key: string; name: string; open: number; done: number; total: number; overdue: number };

/**
 * The team as rings: each person's initials inside a ring showing how much of
 * their work is done, with open and overdue counts written underneath.
 * Busiest first; the rings draw in on first show.
 */
export default function TeamRings({ tasks, currentUserKey }: { tasks: TeamTask[]; currentUserKey: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setDrawn(true)); return () => cancelAnimationFrame(frame); }, []);

  const people = new Map<string, Person>();
  for (const task of tasks) {
    if (task.assigneeKey === "unassigned" || task.status === "CANCELLED") continue;
    const person = people.get(task.assigneeKey) ?? { key: task.assigneeKey, name: task.assigneeName, open: 0, done: 0, total: 0, overdue: 0 };
    person.total += 1;
    if (task.status === "COMPLETED") person.done += 1; else person.open += 1;
    if (task.overdue) person.overdue += 1;
    people.set(task.assigneeKey, person);
  }
  const sorted = [...people.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

  if (sorted.length === 0) return <p className={styles.quiet}>Nobody has tasks yet.</p>;

  return <ul className={styles.team}>
      {sorted.slice(0, MAX_PEOPLE).map((person, index) => {
        const share = person.total ? person.done / person.total : 0;
        const initials = person.name.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2);
        return <li key={person.key} className={styles.member}
          aria-label={`${person.name}: ${person.open} open, ${person.done} of ${person.total} done${person.overdue ? `, ${person.overdue} overdue` : ""}`}>
          <svg viewBox="0 0 64 64" className={styles.ring} aria-hidden="true">
            <circle cx="32" cy="32" r={R} className={styles.ringTrack} />
            <circle cx="32" cy="32" r={R} className={styles.ringFill} data-late={person.overdue > 0 || undefined} data-empty={!drawn || share === 0 || undefined}
              strokeDasharray={`${drawn ? share * C : 0} ${C}`} transform="rotate(-90 32 32)"
              style={{ transitionDelay: index * 60 + "ms" }} />
            <text x="32" y="37" textAnchor="middle" className={styles.ringInitials}>{initials}</text>
          </svg>
          <span className={styles.memberName} title={person.name}>
            {person.key === currentUserKey ? "You" : person.name.split(" ")[0]}
          </span>
          <span className={styles.memberMeta}>
            {person.open} open{person.overdue > 0 && <b> · {person.overdue} late</b>}
          </span>
        </li>;
      })}
  </ul>;
}
