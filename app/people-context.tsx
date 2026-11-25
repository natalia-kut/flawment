"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { TeamPerson } from "@/lib/teams/data";
import PersonDialog from "./person-dialog";

type People = { has: (id: number) => boolean; open: (id: number) => void };

const PeopleContext = createContext<People | null>(null);

/** Lets any name inside it open that person's profile. */
export function PeopleProvider({ people, teams, currentUserId, children }: {
  people: TeamPerson[]; teams: { id: number; name: string }[]; currentUserId: number; children: ReactNode;
}) {
  const here = useSearchParams().toString();
  // Remembers where it was opened, so going to another page closes it.
  const [opened, setOpened] = useState<{ id: number; at: string } | null>(null);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const value = useMemo<People>(() => ({ has: (id) => byId.has(id), open: (id) => setOpened({ id, at: here }) }), [byId, here]);
  const person = opened?.at === here ? byId.get(opened.id) : undefined;
  return <PeopleContext value={value}>
    {children}
    {person && <PersonDialog key={person.id} person={person} you={person.id === currentUserId}
      team={teams.find((team) => team.id === person.teamId)} onClose={() => setOpened(null)} />}
  </PeopleContext>;
}

/**
 * A person's name (or their tile) that opens their profile. Someone outside the
 * directory (a super admin, a closed account) stays plain text.
 */
export function PersonButton({ id, name, className = "", decorative = false, children }: {
  id: number | null | undefined; name: string; className?: string; children: ReactNode;
  /** A face beside a name that already opens the profile: no second stop for the keyboard or a screen reader. */
  decorative?: boolean;
}) {
  const people = use(PeopleContext);
  if (id == null || !people?.has(id)) return <span className={className}>{children}</span>;
  return <button type="button" className={"person-link " + className} onClick={() => people.open(id)}
    {...(decorative ? { tabIndex: -1, "aria-hidden": true } : { "aria-label": name + ": show profile", "aria-haspopup": "dialog" as const })}>{children}</button>;
}
