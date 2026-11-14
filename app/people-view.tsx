"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/page-header";
import { jobTitleAction, personAction, type PersonState } from "@/lib/people/actions";
import type { PeopleDirectory } from "@/lib/people/data";
import UserAvatar from "./user-avatar";
import JobTitleField from "./job-title-field";
import styles from "./people-view.module.css";
import { isManagerialTitle } from "@/lib/people/job-titles";
import { useConfirm } from "@/components/ui/confirm";
import { PencilIcon } from "@/components/ui/icons";

type Person = PeopleDirectory["people"][number];

/** The super admin's list of every account, where their details are edited. */
export default function PeopleView({ directory }: { directory: PeopleDirectory }) {
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const query = filter.trim().toLowerCase();
  const titleName = (id: number | null) => directory.jobTitles.find((t) => t.id === id)?.name;
  const teamName = (id: number | null) => directory.teams.find((t) => t.id === id)?.name;
  const people = directory.people.filter((p) => !query
    || [p.first_name, p.last_name, p.email, titleName(p.job_title_id), teamName(p.team_id)].join(" ").toLowerCase().includes(query));
  const editing = directory.people.find((p) => p.id === editingId);

  return <>
    <PageHeader title="People" />
    <details open className={"workspace-card people-table-card " + styles.collapsible}>
      <summary><h2>Everyone <span className="role-badge">{directory.people.length}</span></h2></summary>
      {/* Outside the summary: a space typed into it would fold the card. */}
      <input type="search" className={"people-search " + styles.headerSearch} placeholder="Search name, email, title or team" aria-label="Search people" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {people.length === 0 ? <p>No matching people.</p> : <table className={"people-table " + styles.table}>
        <thead><tr><th scope="col">Person</th><th scope="col">Job title</th><th scope="col">Team</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{people.map((person) => <tr key={person.id}>
          <td><div className="member-identity"><UserAvatar id={person.id} firstName={person.first_name} lastName={person.last_name} photoVersion={person.photoVersion} size={32} />
            <div><strong>{person.first_name} {person.last_name}</strong><small>{person.email}</small></div></div></td>
          <td>{titleName(person.job_title_id) ?? <span className="muted-value">Not set</span>}</td>
          <td>{person.role === "SUPER_ADMIN" ? <span className="role-badge">Super admin</span>
            : <>{teamName(person.team_id) ?? <span className="muted-value">No team</span>}{person.team_lead && <span className="role-badge lead-badge">Lead</span>}</>}</td>
          <td><button type="button" className={"icon-button edit " + styles.rowAction} onClick={() => setEditingId(person.id)}
            aria-label={`Edit ${person.first_name} ${person.last_name}`} title="Edit"><PencilIcon /></button></td>
        </tr>)}</tbody>
      </table>}
    </details>
    <JobTitles directory={directory} />
    {editing && <EditPerson key={editing.id} person={editing} directory={directory} onClose={() => setEditingId(null)} />}
  </>;
}

export function EditPerson({ person, directory, onClose }: { person: Person; directory: PeopleDirectory; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [titleText, setTitleText] = useState(directory.jobTitles.find((t) => t.id === person.job_title_id)?.name ?? "");
  const [teamId, setTeamId] = useState(person.team_id ? String(person.team_id) : "");
  // Typed text picks a title from the list by name; any other name is added as a new one.
  const typedTitle = titleText.trim().replace(/\s+/g, " ");
  const matchedTitle = directory.jobTitles.find((t) => t.name.toLowerCase() === typedTitle.toLowerCase());
  const titleId = !typedTitle ? "" : matchedTitle ? String(matchedTitle.id) : "new";
  const [lead, setLead] = useState(person.team_lead);
  const [state, action, pending] = useActionState(async (previous: PersonState, data: FormData) => {
    const result = await personAction(previous, data);
    if (result.success) onClose();
    return result;
  }, {});
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const admin = person.role === "SUPER_ADMIN";
  // Only managerial titles may lead, and only within a team.
  const managerial = matchedTitle ? matchedTitle.can_lead : !!typedTitle && isManagerialTitle(typedTitle);
  const canLead = !admin && teamId !== "" && managerial;
  const team = directory.teams.find((t) => String(t.id) === teamId);
  // A team has one lead: someone else leading it is named, and replaced on save.
  const currentLead = directory.people.find((p) => p.team_lead && p.id !== person.id && String(p.team_id) === teamId);
  const leadHelp = !teamId ? "Put them in a team to make them its lead."
    : !managerial ? (typedTitle ? `${typedTitle} is not a managerial job title, so they cannot lead a team.` : "Give them a managerial job title (a manager, lead, head…) to make them a team lead.")
    : currentLead && lead ? `${currentLead.first_name} ${currentLead.last_name} will no longer lead ${team?.name}.`
    : currentLead ? `${currentLead.first_name} ${currentLead.last_name} leads ${team?.name} now.`
    : null;

  return <dialog ref={ref} className="project-dialog" aria-labelledby="edit-person-title" onCancel={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="project-dialog-content">
      <div className="project-dialog-heading"><h2 id="edit-person-title">{person.first_name} {person.last_name}</h2><button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">×</button></div>
      <p>@{person.username}{admin ? " · Super admin" : ""}</p>
      <form action={action} className="workspace-form">
        <input type="hidden" name="user_id" value={person.id} />
        <fieldset disabled={pending}>
          <div className="form-row">
            <label>First name<input name="first_name" required maxLength={60} defaultValue={person.first_name} /></label>
            <label>Last name<input name="last_name" required maxLength={60} defaultValue={person.last_name} /></label>
          </div>
          <label>Email<input name="email" type="email" required maxLength={254} defaultValue={person.email} /></label>
          <input type="hidden" name="job_title_id" value={titleId} />
          {titleId === "new" && <input type="hidden" name="new_job_title" value={typedTitle} />}
          <JobTitleField titles={directory.jobTitles} value={titleText} onChange={setTitleText}
            hint={titleId === "new" && <>&ldquo;{typedTitle}&rdquo; will be added as a new job title.</>} />
          {admin ? <p className="field-help">Super admins are not part of a team.</p> : <>
            <label>Team
              <select name="team_id" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">No team</option>
                {directory.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <div className={styles.leadField}>
              <label className="checkbox-label">
                <input type="checkbox" name="team_lead" checked={lead && canLead} disabled={!canLead} aria-describedby="lead-help"
                  onChange={(e) => setLead(e.target.checked)} />
                {currentLead && canLead ? `Make ${person.first_name} the lead instead` : "Leads this team"}
              </label>
              {leadHelp && <p id="lead-help" className={"field-help" + (canLead && currentLead && lead ? " " + styles.replacing : "")}>{leadHelp}</p>}
            </div>
          </>}
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button className="primary-button">{pending ? "Saving…" : "Save"}</button>
          </div>
        </fieldset>
      </form>
    </div>
  </dialog>;
}

/**
 * Every job title, and whether it is managerial (may lead a team and start projects).
 * A new title gets this from its name; here a super admin corrects the name's guess.
 */
function JobTitles({ directory }: { directory: PeopleDirectory }) {
  const [state, action, pending] = useActionState(jobTitleAction, {});
  // Drag a chip into the other group, or click it: both move it across.
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<"lead" | "other" | null>(null);
  const draggedTitle = directory.jobTitles.find((t) => t.id === dragged);
  const groups = [
    { key: "lead", label: "Can lead a team", empty: "None yet", titles: directory.jobTitles.filter((t) => t.can_lead) },
    { key: "other", label: "Other titles", empty: "None", titles: directory.jobTitles.filter((t) => !t.can_lead) },
  ] as const;
  const ask = useConfirm();
  async function toggle(title: PeopleDirectory["jobTitles"][number]) {
    const canLead = !title.can_lead;
    const leads = directory.people.filter((p) => p.job_title_id === title.id && p.team_lead);
    // Taking it away ends their lead role: name who loses it and ask first.
    if (!canLead && leads.length > 0 && !await ask({
      title: `${title.name} can no longer lead a team?`,
      message: `${leads.map((p) => `${p.first_name} ${p.last_name}`).join(", ")} will no longer lead ${leads.length === 1 ? "their team" : "their teams"}.`,
      confirm: "Move to Other titles",
    })) return;
    const data = new FormData();
    data.set("job_title_id", String(title.id));
    if (canLead) data.set("can_lead", "on");
    startTransition(() => action(data));
  }
  const chips = (titles: typeof directory.jobTitles) => <ul className={styles.chips}>
    {titles.map((title) => {
      const count = directory.people.filter((p) => p.job_title_id === title.id).length;
      return <li key={title.id}><button type="button" className={styles.chip} data-lead={title.can_lead || undefined} disabled={pending}
        draggable={!pending} data-dragging={dragged === title.id || undefined}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", title.name); e.dataTransfer.effectAllowed = "move"; setDragged(title.id); }}
        onDragEnd={() => { setDragged(null); setOver(null); }}
        aria-pressed={title.can_lead} title={title.can_lead ? "Drag or click to move to Other titles" : "Drag or click to move to Can lead a team"}
        onClick={() => toggle(title)}>
        {title.name}{count > 0 && <span className={styles.chipCount} aria-label={count === 1 ? "1 person" : count + " people"}>{count}</span>}
      </button></li>;
    })}
  </ul>;

  // Rarely needed, so folded away under the list of people.
  return <details className={"workspace-card " + styles.collapsible}>
    <summary>
      <h2>Job titles <span className="role-badge">{directory.jobTitles.length}</span></h2>
      <span className={styles.summaryHint}>{groups[0].titles.length} can lead a team</span>
    </summary>
    <p className="field-help">To change who can lead a team, drag a title to the right group.</p>
    {directory.jobTitles.length === 0 ? <p>No job titles yet. Add one when editing a person.</p> : <div className={styles.groups}>
      {groups.map(({ key, label, empty, titles }) => {
        // Only the other group accepts the chip: dropping it where it is changes nothing.
        const accepts = !!draggedTitle && draggedTitle.can_lead !== (key === "lead");
        return <div key={key} className={styles.group} data-over={(accepts && over === key) || undefined}
          onDragOver={(e) => { if (!accepts) return; e.preventDefault(); if (over !== key) setOver(key); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
          onDrop={(e) => { e.preventDefault(); setDragged(null); setOver(null); if (accepts) toggle(draggedTitle); }}>
          <h3>{label}</h3>
          {titles.length ? chips(titles) : <p className="muted-value">{empty}</p>}
        </div>;
      })}
    </div>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </details>;
}
