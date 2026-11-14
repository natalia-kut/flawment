"use client";

import { useState } from "react";
import type { TeamPerson } from "@/lib/teams/data";
import UserAvatar from "./user-avatar";
import styles from "./this-month.module.css";

const joinedDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
/** Three rows of two; the rest wait behind "Show all". */
const PREVIEW = 6;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The month's good news in one compact card: who joined and who was promoted,
 * a row each with a button to say hello or send congratulations.
 */
export default function ThisMonth({ newPeople, promotions, teamName }: {
  newPeople: TeamPerson[]; promotions: { person: TeamPerson; title: string }[]; teamName: (id: number | null) => string | undefined;
}) {
  const [showAll, setShowAll] = useState(false);
  const entries = [
    ...newPeople.map((person) => {
      const team = teamName(person.teamId);
      const role = person.jobTitle && team ? `${person.jobTitle} in ${team}` : person.jobTitle ?? team;
      return { key: `j${person.id}`, person, kind: "welcome" as const, emoji: "👋", action: "Say hello",
        line: ["Joined " + joinedDay.format(new Date(person.joinedOn + "T00:00:00Z")), role].filter(Boolean).join(" · ") };
    }),
    ...promotions.map(({ person, title }) => ({ key: `p${person.id}-${title}`, person, kind: "promotion" as const, emoji: "🎉", action: "Send congrats", line: `Now ${title}` })),
  ];
  if (entries.length === 0) return null;
  const shown = showAll ? entries : entries.slice(0, PREVIEW);
  const summary = [newPeople.length && plural(newPeople.length, "new teammate", "new teammates"),
    promotions.length && plural(promotions.length, "promotion", "promotions")].filter(Boolean).join(" and ");

  return <section className={styles.card} aria-labelledby="this-month-title">
    <span className={styles.confetti} aria-hidden="true" />
    <p className={styles.eyebrow}>This month</p>
    <h2 id="this-month-title">{summary}</h2>
    <ul className={styles.rows}>{shown.map((e) => <li key={e.key} data-kind={e.kind}>
      <span className={styles.face}>
        <UserAvatar id={e.person.id} firstName={e.person.first_name} lastName={e.person.last_name} photoVersion={e.person.photoVersion} size={36} />
        <span className={styles.emoji} aria-hidden="true">{e.emoji}</span>
      </span>
      <span className={styles.text}><strong>{e.person.first_name} {e.person.last_name}</strong><small>{e.line}</small></span>
      <a className="secondary-button" href={`mailto:${e.person.email}`} aria-label={`${e.action} to ${e.person.first_name}`}>{e.action}</a>
    </li>)}</ul>
    {entries.length > PREVIEW && <button type="button" className="text-button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
      {showAll ? "Show fewer" : `Show all ${entries.length}`}
    </button>}
  </section>;
}
