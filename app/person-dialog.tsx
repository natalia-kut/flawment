"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import type { TeamPerson } from "@/lib/teams/data";
import { yearsLabel } from "@/lib/time-off/dates";
import UserAvatar from "./user-avatar";
import AvailabilityBadge from "./availability-badge";
import { StatusText } from "./status-dialog";
import EmailText from "./email-text";
import { closeOnBackdrop } from "@/components/ui/backdrop";
import { openModal } from "@/components/ui/use-modal";

/** "🎂 Birthday today" or "🎉 3 years today": shown on the day only. */
export function CelebrationBadge({ person }: { person: TeamPerson }) {
  if (person.birthday?.inDays === 0) return <span className="celebration-badge">🎂 Birthday today</span>;
  if (person.anniversary?.inDays === 0) return <span className="celebration-badge">🎉 {yearsLabel(person.anniversary.years)} today</span>;
  return null;
}

/** Everything about one person: status, birthday, how to reach them, all their skills. */
export default function PersonDialog({ person, you, team, onClose, manage }: {
  person: TeamPerson; you: boolean; onClose: () => void; manage?: ReactNode;
  /** Their team, linked; left out on the team's own page. */
  team?: { id: number; name: string };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    return openModal(dialog);
  }, []);
  const contact = [
    { label: "Email", value: <a href={`mailto:${person.email}`}><EmailText email={person.email} /></a>, wide: true },
    person.phone && { label: "Phone", value: <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}>{person.phone}</a> },
    person.location && { label: "Location", value: person.location },
    person.workingHours && { label: "Working hours", value: person.workingHours },
    person.birthday && { label: "Birthday", value: person.birthday.label },
    team && { label: "Team", value: <Link href={`/?view=team&team=${team.id}`} onClick={onClose}>{team.name}</Link> },
    // `years` is the next anniversary: before the first one there are no whole years to show.
    { label: "With us since", value: person.anniversary?.inDays === 0 ? `${person.joined} · ${yearsLabel(person.anniversary.years)} today 🎉`
      : person.anniversary && person.anniversary.years > 1 ? `${person.joined} · ${yearsLabel(person.anniversary.years - 1)}` : person.joined },
  ].filter(Boolean) as { label: string; value: ReactNode; wide?: boolean }[];
  return <dialog ref={ref} className="project-dialog person-dialog" aria-labelledby="person-dialog-title" onCancel={onClose}
    {...closeOnBackdrop(onClose)}>
    <div className="project-dialog-content">
      <div className="project-dialog-heading">
        <div className="person-dialog-identity">
          <UserAvatar id={person.id} firstName={person.first_name} lastName={person.last_name} photoVersion={person.photoVersion} size={64} />
          <div>
            <h2 id="person-dialog-title">{person.first_name} {person.last_name}{you && <span className="role-badge you-badge">You</span>}<CelebrationBadge person={person} /></h2>
            <p>{[person.jobTitle, person.pronouns].filter(Boolean).join(" · ") || "No job title"}</p>
          </div>
        </div>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">×</button>
      </div>
      <div className="person-card-badges">
        {person.availability ? <AvailabilityBadge availability={person.availability} /> : <span className="availability-badge available">Available</span>}
        {person.teamLead && <span className="role-badge">Team lead</span>}
        {person.status && <StatusText status={person.status} withUntil />}
      </div>
      <dl className="person-dialog-facts">
        {contact.map((item) => <div key={item.label} className={item.wide ? "wide" : undefined}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl>
      {person.skills.length > 0 && <section className="person-dialog-skills">
        <h3>Skills</h3>
        <ul className="skill-list">{person.skills.map((s) => <li key={s} className="skill-chip">{s}</li>)}</ul>
      </section>}
      {manage}
    </div>
  </dialog>;
}
