"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/page-header";
import { teamAction, type TeamState } from "@/lib/teams/actions";
import type { TeamPerson, TeamsOverview } from "@/lib/teams/data";
import UserAvatar from "./user-avatar";
import AvailabilityBadge from "./availability-badge";
import PersonDialog, { CelebrationBadge } from "./person-dialog";
import type { PeopleDirectory } from "@/lib/people/data";
import { EditPerson } from "./people-view";
import TitleRequestControls from "./title-request-controls";
import styles from "./team-view.module.css";
import ThisMonth from "./this-month";
import type { LeadTitleRequests, Promotion } from "@/lib/job-title-requests/data";
import { useConfirmSubmit } from "@/components/ui/confirm";
import EmptyState from "@/components/ui/empty-state";
import { submitInPlace } from "@/components/ui/submit-in-place";

/** For a team lead: their job title requests by person, and the titles to pick from. */
type Lead = { requests: LeadTitleRequests["byPerson"]; jobTitles: { id: number; name: string }[] };

type Team = TeamsOverview["teams"][number];

/**
 * Everyone sees every team as a tile, their own first and marked, and can open
 * any of them. A super admin also creates teams, sets up new hires and, on a
 * team's page, places people and picks its lead.
 */
export default function TeamView({ overview, directory, currentUserId, lead, month, promotions }: {
  overview: TeamsOverview; directory: PeopleDirectory | null; currentUserId: number; lead: Lead | null; promotions: Promotion[];
  /** This month in the workspace (YYYY-MM): who counts as new. */
  month: string;
}) {
  const selected = useSearchParams().get("team");
  if (selected) {
    const team = overview.teams.find((t) => String(t.id) === selected);
    return team ? <TeamPage team={team} currentUserId={currentUserId} own={team.id === overview.myTeamId}
      lead={team.id === overview.myTeamId ? lead : null}
      admin={overview.canManage ? { people: overview.people, teams: overview.teams } : undefined} />
      : <><PageHeader title="Team unavailable" breadcrumbs={<TeamsCrumb />} /><section className="project-empty-state"><h2>This team no longer exists</h2><Link href="/?view=team" className="secondary-button">Back to teams</Link></section></>;
  }
  return <TeamsIndex overview={overview} directory={directory} month={month} promotions={promotions} />;
}

function TeamsCrumb({ name }: { name?: string }) {
  return <nav className="project-breadcrumbs" aria-label="Breadcrumb"><ol>
    <li><Link href="/?view=team">Teams</Link></li>
    {name && <li><span className="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">{name}</span></li>}
  </ol></nav>;
}

/* ---------- Teams index ---------- */

function TeamsIndex({ overview, directory, month, promotions }: { overview: TeamsOverview; directory: PeopleDirectory | null; month: string; promotions: Promotion[] }) {
  const teamName = (id: number | null) => overview.teams.find((t) => t.id === id)?.name;
  const [creating, setCreating] = useState(false);
  const admin = overview.canManage;
  const noTeams = overview.teams.length === 0;
  return <>
    {/* With no teams yet, the empty page has the button instead. */}
    <PageHeader title="Teams" actions={admin && !noTeams && <button className="primary-button" onClick={() => setCreating(true)}><span aria-hidden="true">+</span> New team</button>} />
    {!admin && !noTeams && overview.myTeamId === null && <p className="not-in-team-note">You are not in a team yet. Your administrator will add you to one.</p>}
    {creating && <CreateTeam onDone={() => setCreating(false)} />}
    {/* A super admin finishes setting new people up; everyone else just meets them. */}
    {/* A super admin's work comes first; then the month's good news, for everyone. */}
    {directory && <NewHires directory={directory} />}
    <ThisMonth newPeople={overview.people.filter((p) => p.joinedOn.startsWith(month))} teamName={teamName}
      promotions={promotions.flatMap((r) => overview.people.filter((p) => p.id === r.personId).map((person) => ({ person, title: r.title })))} />
    {noTeams && !creating
      ? <EmptyState art="teams" title="No teams yet"
        action={admin && <button className="primary-button" onClick={() => setCreating(true)}><span aria-hidden="true">+</span> Create your first team</button>}>
        {admin ? "Create teams that mirror your company, then open one to add people." : "Your administrator has not set up any teams yet."}</EmptyState>
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
  // One quiet line, like "13 overdue tasks" on the Tasks board: a chip per person opens their set-up.
  return <section className={styles.setup} aria-labelledby="new-hires-title">
    <h2 id="new-hires-title"><span className={styles.dot} aria-hidden="true" />Finish setting up {pending.length === 1 ? "1 person" : `${pending.length} people`}</h2>
    <ul>{pending.map((p) => <li key={p.id}>
      <button type="button" className={styles.person} onClick={() => setEditingId(p.id)}
        title={`${p.email} · joined ${joinedDate.format(new Date(p.joined))}`} aria-label={`Set up ${p.first_name} ${p.last_name}`}>
        <UserAvatar id={p.id} firstName={p.first_name} lastName={p.last_name} photoVersion={p.photoVersion} size={24} />
        <strong>{p.first_name} {p.last_name}</strong>
        <span className={styles.missing}>{[p.job_title_id === null && "No job title", p.team_id === null && "No team"].filter(Boolean).join(" · ")}</span>
      </button>
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
  return <form action={action} onSubmit={submitInPlace(action)} className="workspace-card create-team-form">
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

function TeamPage({ team, currentUserId, own, lead, admin }: {
  team: Team; currentUserId: number; own: boolean; lead: Lead | null;
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
      manage={admin ? <div className="dialog-actions"><MemberControls person={open} currentLead={team.members.find((p) => p.teamLead && p.id !== open.id)} /></div>
        // Their team lead suggests a new job title; a super admin approves it.
        : lead && open.id !== currentUserId ? <TitleRequestControls key={open.id} person={open} request={lead.requests[open.id]} jobTitles={lead.jobTitles} />
        : undefined} />}
  </>;
}

function TeamActions({ team }: { team: Team }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [renameState, rename, renamePending] = useTeamForm(() => setRenaming(false));
  const [deleteState, remove, deletePending] = useTeamForm(() => router.push("/?view=team"));
  const confirmSubmit = useConfirmSubmit();
  if (renaming) return <form action={rename} onSubmit={submitInPlace(rename)} className="team-rename">
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
    <form action={remove} onSubmit={confirmSubmit({ title: `Delete the ${team.name} team?`, message: "Its people stay, just without a team.", confirm: "Delete team" })}>
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
  return <form action={action} onSubmit={submitInPlace(action)} className="workspace-card add-member-form">
    <input type="hidden" name="operation" value="assign" /><input type="hidden" name="team_id" value={team.id} />
    {/* Where the list says they are now, so a move warning is never skipped. */}
    {selected && <input type="hidden" name="expected_team_id" value={selected.teamId ?? ""} />}
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
  const confirmSubmit = useConfirmSubmit();
  // A team has one lead, so making someone else the lead replaces the current one: ask first.
  const replaces = !person.teamLead && currentLead;
  return <div className="member-admin">
    <form action={lead} onSubmit={replaces ? confirmSubmit({
      title: `Make ${person.first_name} the team lead?`, message: `${currentLead.first_name} ${currentLead.last_name} leads this team now and will hand over.`,
      confirm: "Make team lead", danger: false,
    }) : undefined}>
      <input type="hidden" name="operation" value="lead" /><input type="hidden" name="user_id" value={person.id} />
      {/* The team this card shows: refused if they have moved since. */}
      <input type="hidden" name="expected_team_id" value={person.teamId ?? ""} />
      {!person.teamLead && <input type="hidden" name="team_lead" value="on" />}
      {/* Leading is for managers, so the job title decides who can. */}
      <button className="text-button" disabled={leadPending || (!person.teamLead && !person.canLead)}
        title={!person.teamLead && !person.canLead ? "Only people with a managerial job title can lead a team" : undefined}>
        {person.teamLead ? "Remove as lead" : "Make team lead"}
      </button>
    </form>
    <form action={remove} onSubmit={confirmSubmit({ title: `Remove ${person.first_name} from this team?`, message: "They keep their account, just without a team.", confirm: "Remove" })}>
      <input type="hidden" name="operation" value="assign" /><input type="hidden" name="user_id" value={person.id} />
      <input type="hidden" name="expected_team_id" value={person.teamId ?? ""} />
      <button className="text-button danger" disabled={removePending}>Remove from team</button>
    </form>
    {(leadState.error || removeState.error) && <p className="form-error" role="alert">{leadState.error ?? removeState.error}</p>}
  </div>;
}

/* ---------- Shared pieces ---------- */

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

function WarningIcon() {
  return <svg className="warning-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 20h20zM12 10v4M12 17.5v.5" /></svg>;
}
