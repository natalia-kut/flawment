"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard-widgets.module.css";
import type { Availability } from "@/lib/time-off/availability";
import { formatShortDay } from "@/lib/time-off/dates";

/** What the ring shows about the person beyond their tasks. */
type RingPerson = { availability: Availability; celebratesToday: "birthday" | "anniversary" | null };

export type TeamTask = { status: string; overdue: boolean; assigneeKey: string; assigneeName: string };

const R = 26;
const C = 2 * Math.PI * R;
const MAX_PEOPLE = 8;

type Person = { key: string; name: string; open: number; done: number; total: number; overdue: number };

/**
 * The team as rings: each person's initials inside a ring showing how much of
 * their work is done, with open and overdue counts written underneath.
 * Someone away today is dimmed with a moon; a birthday or work anniversary
 * today gets a festive outline. Busiest first; the rings draw in on first show.
 */
export default function TeamRings({ tasks, currentUserKey, people: details = new Map() }: {
  tasks: TeamTask[]; currentUserKey: string; people?: Map<string, RingPerson>;
}) {
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
        const extra = details.get(person.key);
        const away = extra?.availability?.state === "away" ? extra.availability : null;
        const festive = extra?.celebratesToday ?? null;
        const note = [away && `out of office until ${formatShortDay(away.until)}`, festive === "birthday" && "birthday today", festive === "anniversary" && "work anniversary today"].filter(Boolean).join(", ");
        return <li key={person.key} className={styles.member} data-away={away ? true : undefined} data-festive={festive ?? undefined}
          aria-label={`${person.name}: ${person.open} open, ${person.done} of ${person.total} done${person.overdue ? `, ${person.overdue} overdue` : ""}${note ? `; ${note}` : ""}`}>
          <span className={styles.ringWrap}>
          <svg viewBox="0 0 72 72" className={styles.ring} aria-hidden="true">
            {festive && <circle cx="36" cy="36" r="34" className={styles.festiveRing} data-kind={festive} />}
            <g transform="translate(4 4)">
            <circle cx="32" cy="32" r={R} className={styles.ringTrack} />
            <circle cx="32" cy="32" r={R} className={styles.ringFill} data-late={person.overdue > 0 || undefined} data-empty={!drawn || share === 0 || undefined}
              strokeDasharray={`${drawn ? share * C : 0} ${C}`} transform="rotate(-90 32 32)"
              style={{ transitionDelay: index * 60 + "ms" }} />
            <text x="32" y="37" textAnchor="middle" className={styles.ringInitials}>{initials}</text>
            </g>
          </svg>
          {festive ? <span className={styles.ringBadge} aria-hidden="true">{festive === "birthday" ? "🎂" : "🎉"}</span>
            : away && <span className={`${styles.ringBadge} ${styles.awayBadge}`} aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
            </span>}
          </span>
          <span className={styles.memberName} title={person.name}>
            {person.key === currentUserKey ? "You" : person.name.split(" ")[0]}
          </span>
          <span className={styles.memberMeta}>
            {person.open} open{person.overdue > 0 && <b> · {person.overdue} late</b>}
          </span>
          {away && <span className={styles.awayNote}>Out until {formatShortDay(away.until)}</span>}
        </li>;
      })}
  </ul>;
}
