"use client";

import { useActionState, useState, type ReactNode } from "react";
import PageHeader from "@/components/page-header";
import { teamAction, type TeamState } from "@/lib/teams/actions";
import type { TeamPerson, TeamsOverview } from "@/lib/teams/data";
import UserAvatar from "./user-avatar";
import AvailabilityBadge from "./availability-badge";
import { StatusText } from "./status-dialog";
import { yearsLabel } from "@/lib/time-off/dates";

const CELEBRATION_WINDOW = 30;

export default function TeamView({ overview, currentUserId }: { overview: TeamsOverview; currentUserId: number }) {
  return overview.canManage ? <ManageTeams overview={overview} /> : <MyTeam overview={overview} currentUserId={currentUserId} />;
}

/* ---------- A standard user: their own team ---------- */

function MyTeam({ overview, currentUserId }: { overview: TeamsOverview; currentUserId: number }) {
  const team = overview.teams[0];
  if (!team) return <>
    <PageHeader title="Team" />
    <section className="project-empty-state">
      <span aria-hidden="true">◎</span>
      <h2>You are not in a team yet</h2>
      <p>Your administrator assigns teams. Once you are in one, you will see your teammates and who is away here.</p>
    </section>
  </>;
  const away = team.members.filter((p) => p.availability?.state === "away");
  return <>
    <PageHeader title={team.name} description={`Your team · ${team.members.length} ${team.members.length === 1 ? "person" : "people"}${overview.leadsMyTeam ? " · As team lead, you also see why someone is away." : ""}`} />
    <div className="team-layout">
      <ul className="people-grid">{team.members.map((person) => <PersonCard key={person.id} person={person} you={person.id === currentUserId} />)}</ul>
      <aside className="team-sidebar">
        <section className="workspace-card">
          <h2>Away now</h2>
          {away.length === 0 ? <p>Everyone is in today.</p>
            : <ul className="mini-list">{away.map((p) => <MiniPerson key={p.id} person={p}><AvailabilityBadge availability={p.availability!} /></MiniPerson>)}</ul>}
        </section>
        <Celebrations people={team.members} />
      </aside>
    </div>
  </>;
}

/** Birthdays and work anniversaries in the next few weeks, soonest first. */
function Celebrations({ people }: { people: TeamPerson[] }) {
  const events = people.flatMap((p) => [
    ...(p.birthday && p.birthday.inDays <= CELEBRATION_WINDOW ? [{ person: p, inDays: p.birthday.inDays, emoji: "🎂", what: p.birthday.label }] : []),
    ...(p.anniversary && p.anniversary.inDays <= CELEBRATION_WINDOW ? [{ person: p, inDays: p.anniversary.inDays, emoji: "🎉", what: `${yearsLabel(p.anniversary.years)} with us` }] : []),
  ]).sort((a, b) => a.inDays - b.inDays);
  const when = (days: number) => days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return <section className="workspace-card">
    <h2>Celebrations</h2>
    {events.length === 0 ? <p>Nothing to celebrate in the next {CELEBRATION_WINDOW} days.</p>
      : <ul className="mini-list">{events.map((e) => <MiniPerson key={`${e.person.id}-${e.emoji}`} person={e.person}>
        <small className={e.inDays === 0 ? "birthday-today" : undefined}><span aria-hidden="true">{e.emoji}</span> {e.what} · {when(e.inDays)}</small>
      </MiniPerson>)}</ul>}
  </section>;
}

function PersonCard({ person, you = false }: { person: TeamPerson; you?: boolean }) {
  return <li className="person-card workspace-card">
    <div className="person-card-top">
      <UserAvatar id={person.id} firstName={person.first_name} lastName={person.last_name} photoVersion={person.photoVersion} size={52} />
      <div>
        <strong>{person.first_name} {person.last_name}{you && <span className="role-badge you-badge">You</span>}</strong>
        <small>{[person.jobTitle, person.pronouns].filter(Boolean).join(" · ") || person.email}</small>
      </div>
    </div>
    {person.status && <StatusText status={person.status} withUntil />}
    <div className="person-card-badges">
      {person.availability ? <AvailabilityBadge availability={person.availability} /> : <span className="availability-badge available">Available</span>}
      {person.teamLead && <span className="role-badge">Team lead</span>}
      {person.birthday && <span className="birthday-badge" title="Birthday">🎂 {person.birthday.label}</span>}
    </div>
    {person.skills.length > 0 && <ul className="skill-list" aria-label="Skills">{person.skills.slice(0, 6).map((s) => <li key={s} className="skill-chip">{s}</li>)}</ul>}
    <ul className="person-card-contact">
      <li><a href={`mailto:${person.email}`}>{person.email}</a></li>
      {person.phone && <li><a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}>{person.phone}</a></li>}
      {(person.location || person.workingHours) && <li>{[person.location, person.workingHours].filter(Boolean).join(" · ")}</li>}
    </ul>
  </li>;
}

function MiniPerson({ person, children }: { person: TeamPerson; children: ReactNode }) {
  return <li>
    <UserAvatar id={person.id} firstName={person.first_name} lastName={person.last_name} photoVersion={person.photoVersion} size={32} />
    <div><strong>{person.first_name} {person.last_name}</strong>{children}</div>
  </li>;
}

/* ---------- A super admin: every team, and who is in which ---------- */

function useTeamForm(onSuccess?: () => void) {
  return useActionState(async (previous: TeamState, data: FormData) => {
    const result = await teamAction(previous, data);
    if (result.success) onSuccess?.();
    return result;
  }, {});
}

function ManageTeams({ overview }: { overview: TeamsOverview }) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const people = overview.people.filter((p) => !query || `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(query));
  return <>
    <PageHeader title="Teams" actions={<button className="primary-button" onClick={() => setCreating(true)}><span aria-hidden="true">+</span> New team</button>} />
    {creating && <CreateTeam onDone={() => setCreating(false)} />}
    {overview.teams.length === 0 && !creating
      ? <section className="project-empty-state"><span aria-hidden="true">◎</span><h2>No teams yet</h2><p>Create teams that mirror your company, then place people in them below.</p></section>
      : <ul className="team-grid">{overview.teams.map((team) => <TeamCard key={team.id} team={team} />)}</ul>}

    <section className="workspace-card people-table-card">
      <div className="section-heading">
        <div><h2>People <span className="role-badge">{overview.people.length}</span></h2>
          <p>{overview.unassigned.length ? `${overview.unassigned.length} not in a team yet.` : "Everyone is in a team."}</p></div>
        <input type="search" className="people-search" placeholder="Search people" aria-label="Search people" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {people.length === 0 ? <p>No matching people.</p> : <table className="people-table">
        <thead><tr><th scope="col">Person</th><th scope="col">Job title</th><th scope="col">Status</th><th scope="col">Team</th><th scope="col">Lead</th></tr></thead>
        <tbody>{people.map((person) => <tr key={person.id}>
          <td><div className="member-identity"><UserAvatar id={person.id} firstName={person.first_name} lastName={person.last_name} photoVersion={person.photoVersion} size={32} />
            <div><strong>{person.first_name} {person.last_name}</strong><small>{person.email}</small></div></div></td>
          <td><JobTitle key={`${person.id}-${person.jobTitle}`} person={person} /></td>
          <td>{person.availability ? <AvailabilityBadge availability={person.availability} /> : <span className="availability-badge available">Available</span>}</td>
          <td><AssignTeam key={`${person.id}-${person.teamId}`} person={person} teams={overview.teams} /></td>
          <td><LeadToggle key={`${person.id}-${person.teamId}-${person.teamLead}`} person={person} /></td>
        </tr>)}</tbody>
      </table>}
    </section>
  </>;
}

function CreateTeam({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useTeamForm(onDone);
  return <form action={action} className="workspace-card create-team-form">
    <input type="hidden" name="operation" value="create" />
    <fieldset disabled={pending}>
      <label>Team name<input name="name" required maxLength={80} autoFocus placeholder="e.g. Frontend" /></label>
      <button type="button" className="secondary-button" onClick={onDone}>Cancel</button>
      <button className="primary-button">{pending ? "Creating…" : "Create team"}</button>
    </fieldset>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}

function TeamCard({ team }: { team: TeamsOverview["teams"][number] }) {
  const [renaming, setRenaming] = useState(false);
  const [renameState, rename, renamePending] = useTeamForm(() => setRenaming(false));
  const [deleteState, remove, deletePending] = useTeamForm();
  const away = team.members.filter((p) => p.availability?.state === "away").length;
  return <li className="workspace-card team-card">
    {renaming ? <form action={rename} className="team-rename">
      <input type="hidden" name="operation" value="rename" /><input type="hidden" name="team_id" value={team.id} />
      <fieldset disabled={renamePending}>
        <input name="name" defaultValue={team.name} required maxLength={80} aria-label="Team name" autoFocus />
        <button className="primary-button">Save</button>
        <button type="button" className="secondary-button" onClick={() => setRenaming(false)}>Cancel</button>
      </fieldset>
      {renameState.error && <p className="form-error" role="alert">{renameState.error}</p>}
    </form> : <div className="team-card-heading">
      <div><h2>{team.name}</h2><p>{team.members.length} {team.members.length === 1 ? "person" : "people"}{away ? ` · ${away} away` : ""}</p>
        {team.members.some((p) => p.teamLead) && <p>Led by {team.members.filter((p) => p.teamLead).map((p) => `${p.first_name} ${p.last_name}`).join(", ")}</p>}</div>
      <div className="team-card-actions">
        <button type="button" className="text-button" onClick={() => setRenaming(true)}>Rename</button>
        <form action={remove} onSubmit={(e) => { if (!window.confirm(`Delete the ${team.name} team? Its people stay, just without a team.`)) e.preventDefault(); }}>
          <input type="hidden" name="operation" value="delete" /><input type="hidden" name="team_id" value={team.id} />
          <button className="text-button danger" disabled={deletePending}>Delete</button>
        </form>
      </div>
    </div>}
    {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
    {team.members.length === 0 ? <p className="team-card-empty">No one yet. Assign people in the table below.</p>
      : <ul className="avatar-stack" aria-label={`${team.name} members`}>{team.members.map((p) => <li key={p.id} title={`${p.first_name} ${p.last_name}${p.availability ? ` · ${p.availability.label}` : ""}`}
        className={p.availability?.state === "away" ? "is-away" : undefined}>
        <UserAvatar id={p.id} firstName={p.first_name} lastName={p.last_name} photoVersion={p.photoVersion} size={34} />
        <span className="visually-hidden">{p.first_name} {p.last_name}</span>
      </li>)}</ul>}
  </li>;
}

function JobTitle({ person }: { person: TeamPerson }) {
  const [state, action, pending] = useTeamForm();
  const saved = person.jobTitle ?? "";
  return <form action={action} className="job-title-form">
    <input type="hidden" name="operation" value="job_title" /><input type="hidden" name="user_id" value={person.id} />
    {/* Saves when you leave the field or press Enter, like a spreadsheet cell. */}
    <input name="job_title" defaultValue={saved} maxLength={80} placeholder="Add job title" disabled={pending}
      aria-label={`Job title for ${person.first_name} ${person.last_name}`}
      onBlur={(e) => { if (e.currentTarget.value.trim() !== saved) e.currentTarget.form?.requestSubmit(); }}
      onKeyDown={(e) => {
        // Enter saves through blur, so one edit is never submitted twice.
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { e.currentTarget.value = saved; e.currentTarget.blur(); }
      }} />
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}

function LeadToggle({ person }: { person: TeamPerson }) {
  const [state, action, pending] = useTeamForm();
  return <form action={action} className="lead-toggle">
    <input type="hidden" name="operation" value="lead" /><input type="hidden" name="user_id" value={person.id} />
    {/* Leads see why their team members are away, so this is a deliberate choice per person. */}
    <label title={person.teamId === null ? "Put this person in a team first" : undefined}>
      <input type="checkbox" name="team_lead" defaultChecked={person.teamLead} disabled={pending || person.teamId === null}
        onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      <span className="visually-hidden">{person.first_name} {person.last_name} leads their team</span>
    </label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}

function AssignTeam({ person, teams }: { person: TeamPerson; teams: TeamsOverview["teams"] }) {
  const [state, action, pending] = useTeamForm();
  return <form action={action} className="assign-team">
    <input type="hidden" name="operation" value="assign" /><input type="hidden" name="user_id" value={person.id} />
    {/* Saves on change: one select per person is quicker than a separate Save button. */}
    <select name="team_id" defaultValue={person.teamId ?? ""} disabled={pending} aria-label={`Team for ${person.first_name} ${person.last_name}`}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      <option value="">No team</option>
      {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
    </select>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
