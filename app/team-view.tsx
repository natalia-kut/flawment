"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/page-header";
import { teamAction, type TeamState } from "@/lib/teams/actions";
import type { TeamPerson, TeamsOverview } from "@/lib/teams/data";
import UserAvatar from "./user-avatar";
import AvailabilityBadge from "./availability-badge";
import { StatusText } from "./status-dialog";
import { yearsLabel } from "@/lib/time-off/dates";
import type { PeopleDirectory } from "@/lib/people/data";
import { EditPerson } from "./people-view";
import EmailText from "./email-text";

type Team = TeamsOverview["teams"][number];

/**
 * Everyone sees every team as a tile, their own first and marked, and can open
 * any of them. A super admin also creates teams, sets up new hires and, on a
 * team's page, places people and picks its lead.
 */
export default function TeamView({ overview, directory, currentUserId }: { overview: TeamsOverview; directory: PeopleDirectory | null; currentUserId: number }) {
  const selected = useSearchParams().get("team");
  if (selected) {
    const team = overview.teams.find((t) => String(t.id) === selected);
    return team ? <TeamPage team={team} currentUserId={currentUserId} own={team.id === overview.myTeamId}
      admin={overview.canManage ? { people: overview.people, teams: overview.teams } : undefined} />
      : <><PageHeader title="Team unavailable" breadcrumbs={<TeamsCrumb />} /><section className="project-empty-state"><h2>This team no longer exists</h2><Link href="/?view=team" className="secondary-button">Back to teams</Link></section></>;
  }
  return <TeamsIndex overview={overview} directory={directory} />;
}

function TeamsCrumb({ name }: { name?: string }) {
  return <nav className="project-breadcrumbs" aria-label="Breadcrumb"><ol>
    <li><Link href="/?view=team">Teams</Link></li>
    {name && <li><span className="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">{name}</span></li>}
  </ol></nav>;
}

/* ---------- Teams index ---------- */

function TeamsIndex({ overview, directory }: { overview: TeamsOverview; directory: PeopleDirectory | null }) {
  const [creating, setCreating] = useState(false);
  const admin = overview.canManage;
  return <>
    <PageHeader title="Teams" actions={admin && <button className="primary-button" onClick={() => setCreating(true)}><span aria-hidden="true">+</span> New team</button>} />
    {!admin && overview.myTeamId === null && <p className="not-in-team-note">You are not in a team yet. Your administrator will add you to one.</p>}
    {creating && <CreateTeam onDone={() => setCreating(false)} />}
    {directory && <NewHires directory={directory} />}
    {overview.teams.length === 0 && !creating
      ? <section className="project-empty-state"><span aria-hidden="true">◎</span><h2>No teams yet</h2>
        <p>{admin ? "Create teams that mirror your company, then open one to add people." : "Your administrator has not set up any teams yet."}</p></section>
      : <ul className="team-grid">{overview.teams.map((team) => <TeamTile key={team.id} team={team} own={team.id === overview.myTeamId} admin={admin} />)}</ul>}
  </>;
}

const joinedDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Warsaw" });

/** Accounts still missing a job title or a team: new sign-ups land here until a super admin sets them up. */
function NewHires({ directory }: { directory: PeopleDirectory }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const pending = directory.people.filter((p) => p.role !== "SUPER_ADMIN" && (p.job_title_id === null || p.team_id === null));
  const editing = directory.people.find((p) => p.id === editingId);
  if (pending.length === 0) return null;
  return <section className="workspace-card new-hires" aria-labelledby="new-hires-title">
    <div className="section-heading"><div>
      <h2 id="new-hires-title">New hires <span className="role-badge">{pending.length}</span></h2>
      <p>Give them a job title and a team to finish setting them up.</p>
    </div></div>
    <ul>{pending.map((p) => <li key={p.id}>
      <UserAvatar id={p.id} firstName={p.first_name} lastName={p.last_name} photoVersion={p.photoVersion} size={36} />
      <div className="new-hire-name"><strong>{p.first_name} {p.last_name}</strong><small>{p.email} · joined {joinedDate.format(new Date(p.joined))}</small></div>
      <span className="new-hire-missing">
        {p.job_title_id === null && <span className="missing-chip">No job title</span>}
        {p.team_id === null && <span className="missing-chip">No team</span>}
      </span>
      <button type="button" className="secondary-button" onClick={() => setEditingId(p.id)}>Set up</button>
    </li>)}</ul>
    {editing && <EditPerson key={editing.id} person={editing} directory={directory} onClose={() => setEditingId(null)} />}
  </section>;
}

function TeamTile({ team, own, admin }: { team: Team; own: boolean; admin: boolean }) {
  const away = team.members.filter((p) => p.availability?.state === "away").length;
  const leads = team.members.filter((p) => p.teamLead);
  return <li>
    <Link href={`/?view=team&team=${team.id}`} className="workspace-card team-card" data-own={own || undefined}>
      {own && <span className="your-team-badge">Your team</span>}
      <svg className="team-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      <div>
        <h2>{team.name}</h2>
        <p>{team.members.length} {team.members.length === 1 ? "person" : "people"}{away ? ` · ${away} away` : ""}</p>
        {leads.length ? <p>Led by {leads.map((p) => `${p.first_name} ${p.last_name}`).join(", ")}</p>
          : admin ? <p className="no-lead"><WarningIcon />No team lead yet</p> : <p>No team lead yet</p>}
      </div>
      {team.members.length === 0 ? <p className="team-card-empty">No one yet.</p>
        : <ul className="avatar-stack" aria-label={`${team.name} members`}>{team.members.slice(0, 8).map((p) => <li key={p.id}
          className={p.availability?.state === "away" ? "is-away" : undefined}>
          <UserAvatar id={p.id} firstName={p.first_name} lastName={p.last_name} photoVersion={p.photoVersion} size={34} />
          <span className="visually-hidden">{p.first_name} {p.last_name}</span>
        </li>)}</ul>}
    </Link>
  </li>;
}

function useTeamForm(onSuccess?: () => void) {
  return useActionState(async (previous: TeamState, data: FormData) => {
    const result = await teamAction(previous, data);
    if (result.success) onSuccess?.();
    return result;
  }, {});
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

/* ---------- One team (everyone; a super admin also manages it) ---------- */

function TeamPage({ team, currentUserId, own, admin }: {
  team: Team; currentUserId: number; own: boolean;
  /** Present for a super admin: who can be added, and the teams they come from. */
  admin?: { people: TeamPerson[]; teams: Team[] };
}) {
  const count = `${team.members.length} ${team.members.length === 1 ? "person" : "people"}`;
  const [openId, setOpenId] = useState<number | null>(null);
  // Closes by itself when the person leaves the team (e.g. removed from the dialog).
  const open = team.members.find((p) => p.id === openId);
  return <>
    <PageHeader title={team.name} breadcrumbs={<TeamsCrumb name={team.name} />}
      description={own ? `Your team · ${count}` : count}
      actions={admin && <TeamActions team={team} />} />
    {admin && !team.members.some((p) => p.teamLead) && <div className="no-lead-banner" role="status">
      <WarningIcon />
      <p><strong>{team.name} has no team lead yet.</strong>{" "}
        {team.members.some((p) => p.canLead) ? "Open the card of someone with a managerial job title and choose Make team lead."
          : <>Nobody here has a managerial job title yet: give someone one on the <Link href="/?view=people">People page</Link> first.</>}</p>
    </div>}
    {admin && <AddMember team={team} people={admin.people} teams={admin.teams} />}
    {team.members.length === 0 ? <section className="project-empty-state"><h2>No one in this team yet</h2><p>Add people above.</p></section>
      : <ul className="people-grid">{team.members.map((person) => <PersonCard key={person.id} person={person} you={person.id === currentUserId}
        onOpen={() => setOpenId(person.id)} />)}</ul>}
    {open && <PersonDialog person={open} you={open.id === currentUserId} onClose={() => setOpenId(null)}
      manage={admin ? <MemberControls person={open} currentLead={team.members.find((p) => p.teamLead && p.id !== open.id)} /> : undefined} />}
  </>;
}

function TeamActions({ team }: { team: Team }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [renameState, rename, renamePending] = useTeamForm(() => setRenaming(false));
  const [deleteState, remove, deletePending] = useTeamForm(() => router.push("/?view=team"));
  if (renaming) return <form action={rename} className="team-rename">
    <input type="hidden" name="operation" value="rename" /><input type="hidden" name="team_id" value={team.id} />
    <fieldset disabled={renamePending}>
      <input name="name" defaultValue={team.name} required maxLength={80} aria-label="Team name" autoFocus />
      <button className="primary-button">Save</button>
      <button type="button" className="secondary-button" onClick={() => setRenaming(false)}>Cancel</button>
    </fieldset>
    {renameState.error && <p className="form-error" role="alert">{renameState.error}</p>}
  </form>;
  return <>
    <button type="button" className="secondary-button" onClick={() => setRenaming(true)}>Rename</button>
    <form action={remove} onSubmit={(e) => { if (!window.confirm(`Delete the ${team.name} team? Its people stay, just without a team.`)) e.preventDefault(); }}>
      <input type="hidden" name="operation" value="delete" /><input type="hidden" name="team_id" value={team.id} />
      <button className="secondary-button danger-text" disabled={deletePending}>Delete team</button>
    </form>
    {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
  </>;
}

/**
 * Adds someone to this team. Someone already in another team is moved, so
 * that takes a second, explicit step behind a warning.
 */
function AddMember({ team, people, teams }: { team: Team; people: TeamPerson[]; teams: Team[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [state, action, pending] = useTeamForm(() => setSelectedId(""));
  const candidates = people.filter((p) => p.teamId !== team.id)
    .sort((a, b) => Number(a.teamId !== null) - Number(b.teamId !== null));
  const teamName = (id: number | null) => teams.find((t) => t.id === id)?.name;
  const selected = candidates.find((p) => String(p.id) === selectedId);
  const moving = selected?.teamId != null ? selected : null;
  if (candidates.length === 0) return null;
  return <form action={action} className="workspace-card add-member-form">
    <input type="hidden" name="operation" value="assign" /><input type="hidden" name="team_id" value={team.id} />
    <fieldset disabled={pending}>
      <label>Add to {team.name}
        <select name="user_id" required value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="" disabled>Choose a person</option>
          {candidates.map((p) => <option key={p.id} value={p.id}>
            {p.first_name} {p.last_name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}{p.teamId ? ` (now in ${teamName(p.teamId)})` : " (no team)"}
          </option>)}
        </select>
      </label>
      {!moving && <button className="primary-button" disabled={!selected}>{pending ? "Adding…" : "Add"}</button>}
    </fieldset>
    {moving && <div className="move-warning" role="alert">
      <WarningIcon />
      <p>
        <strong>{moving.first_name} {moving.last_name} is in {teamName(moving.teamId)}.</strong>{" "}
        Adding them here moves them out of {teamName(moving.teamId)}{moving.teamLead ? `, and they will no longer lead it` : ""}.
      </p>
      <div>
        <button type="button" className="secondary-button" onClick={() => setSelectedId("")} disabled={pending}>Cancel</button>
        <button className="primary-button" disabled={pending}>{pending ? "Moving…" : `Move to ${team.name}`}</button>
      </div>
    </div>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}

/** Lead and remove controls on a member card (super admin only). */
function MemberControls({ person, currentLead }: { person: TeamPerson; currentLead?: TeamPerson }) {
  const [leadState, lead, leadPending] = useTeamForm();
  const [removeState, remove, removePending] = useTeamForm();
  // A team has one lead, so making someone else the lead replaces the current one: ask first.
  const replaces = !person.teamLead && currentLead;
  return <div className="member-admin">
    <form action={lead} onSubmit={(e) => {
      if (replaces && !window.confirm(`${currentLead.first_name} ${currentLead.last_name} leads this team now. Make ${person.first_name} the lead instead?`)) e.preventDefault();
    }}>
      <input type="hidden" name="operation" value="lead" /><input type="hidden" name="user_id" value={person.id} />
      {!person.teamLead && <input type="hidden" name="team_lead" value="on" />}
      {/* Leading is for managers, so the job title decides who can. */}
      <button className="text-button" disabled={leadPending || (!person.teamLead && !person.canLead)}
        title={!person.teamLead && !person.canLead ? "Only people with a managerial job title can lead a team" : undefined}>
        {person.teamLead ? "Remove as lead" : "Make team lead"}
      </button>
    </form>
    <form action={remove} onSubmit={(e) => { if (!window.confirm(`Remove ${person.first_name} from this team?`)) e.preventDefault(); }}>
      <input type="hidden" name="operation" value="assign" /><input type="hidden" name="user_id" value={person.id} />
      <button className="text-button danger" disabled={removePending}>Remove from team</button>
    </form>
    {(leadState.error || removeState.error) && <p className="form-error" role="alert">{leadState.error ?? removeState.error}</p>}
  </div>;
}

/* ---------- Shared pieces ---------- */

/** "🎂 Birthday today" or "🎉 3 years today": shown on the day only. */
function CelebrationBadge({ person }: { person: TeamPerson }) {
  if (person.birthday?.inDays === 0) return <span className="celebration-badge">🎂 Birthday today</span>;
  if (person.anniversary?.inDays === 0) return <span className="celebration-badge">🎉 {yearsLabel(person.anniversary.years)} today</span>;
  return null;
}

const SKILLS_ON_CARD = 2;

/** The essentials at a glance; the whole card opens the details. */
function PersonCard({ person, you = false, onOpen }: { person: TeamPerson; you?: boolean; onOpen: () => void }) {
  const hidden = person.skills.length - SKILLS_ON_CARD;
  return <li>
    <button type="button" className="person-card workspace-card" onClick={onOpen} aria-label={`${person.first_name} ${person.last_name}: show details`}>
      <span className="person-card-top">
        <UserAvatar id={person.id} firstName={person.first_name} lastName={person.last_name} photoVersion={person.photoVersion} size={48} />
        <span>
          <strong>{person.first_name} {person.last_name}{you && <span className="role-badge you-badge">You</span>}</strong>
          <small>{person.jobTitle ?? "No job title"}</small>
        </span>
      </span>
      <span className="person-card-badges">
        {person.availability ? <AvailabilityBadge availability={person.availability} /> : <span className="availability-badge available">Available</span>}
        {person.teamLead && <span className="role-badge">Team lead</span>}
        <CelebrationBadge person={person} />
      </span>
      {person.skills.length > 0 && <span className="skill-row">
        {person.skills.slice(0, SKILLS_ON_CARD).map((s) => <span key={s} className="skill-chip" title={s}>{s}</span>)}
        {hidden > 0 && <span className="skill-chip more-chip">+{hidden}</span>}
      </span>}
    </button>
  </li>;
}

/** Everything about one person: status, birthday, how to reach them, all their skills. */
function PersonDialog({ person, you, onClose, manage }: { person: TeamPerson; you: boolean; onClose: () => void; manage?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const contact = [
    { label: "Email", value: <a href={`mailto:${person.email}`}><EmailText email={person.email} /></a>, wide: true },
    person.phone && { label: "Phone", value: <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}>{person.phone}</a> },
    person.location && { label: "Location", value: person.location },
    person.workingHours && { label: "Working hours", value: person.workingHours },
    person.birthday && { label: "Birthday", value: person.birthday.label },
    { label: "With us since", value: person.anniversary?.inDays === 0 ? `${person.joined} · ${yearsLabel(person.anniversary.years)} today 🎉`
      : person.anniversary ? `${person.joined} · ${yearsLabel(person.anniversary.years - 1)}` : person.joined },
  ].filter(Boolean) as { label: string; value: ReactNode; wide?: boolean }[];
  return <dialog ref={ref} className="project-dialog person-dialog" aria-labelledby="person-dialog-title" onCancel={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
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
      {manage && <div className="dialog-actions">{manage}</div>}
    </div>
  </dialog>;
}

function WarningIcon() {
  return <svg className="warning-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 20h20zM12 10v4M12 17.5v.5" /></svg>;
}
