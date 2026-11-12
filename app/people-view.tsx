"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/page-header";
import { personAction, type PersonState } from "@/lib/people/actions";
import type { PeopleDirectory } from "@/lib/people/data";
import UserAvatar from "./user-avatar";

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
    <section className="workspace-card people-table-card">
      <div className="section-heading">
        <div><h2>Everyone <span className="role-badge">{directory.people.length}</span></h2></div>
        <input type="search" className="people-search" placeholder="Search name, email, title or team" aria-label="Search people" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {people.length === 0 ? <p>No matching people.</p> : <table className="people-table">
        <thead><tr><th scope="col">Person</th><th scope="col">Job title</th><th scope="col">Team</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{people.map((person) => <tr key={person.id}>
          <td><div className="member-identity"><UserAvatar id={person.id} firstName={person.first_name} lastName={person.last_name} photoVersion={person.photoVersion} size={32} />
            <div><strong>{person.first_name} {person.last_name}</strong><small>{person.email}</small></div></div></td>
          <td>{titleName(person.job_title_id) ?? <span className="muted-value">Not set</span>}</td>
          <td>{person.role === "SUPER_ADMIN" ? <span className="role-badge">Super admin</span>
            : <>{teamName(person.team_id) ?? <span className="muted-value">No team</span>}{person.team_lead && <span className="role-badge lead-badge">Lead</span>}</>}</td>
          <td><button type="button" className="secondary-button" onClick={() => setEditingId(person.id)}>Edit</button></td>
        </tr>)}</tbody>
      </table>}
    </section>
    {editing && <EditPerson key={editing.id} person={editing} directory={directory} onClose={() => setEditingId(null)} />}
  </>;
}

export function EditPerson({ person, directory, onClose }: { person: Person; directory: PeopleDirectory; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [titleId, setTitleId] = useState(person.job_title_id ? String(person.job_title_id) : "");
  const [teamId, setTeamId] = useState(person.team_id ? String(person.team_id) : "");
  const [newTitleCanLead, setNewTitleCanLead] = useState(false);
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
  const canLead = !admin && teamId !== "" && (titleId === "new" ? newTitleCanLead : !!directory.jobTitles.find((t) => String(t.id) === titleId)?.can_lead);

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
          <label>Job title
            <select name="job_title_id" value={titleId} onChange={(e) => setTitleId(e.target.value)}>
              <option value="">No job title</option>
              {directory.jobTitles.map((t) => <option key={t.id} value={t.id}>{t.name}{t.can_lead ? " · can lead a team" : ""}</option>)}
              <option value="new">+ Add a new job title…</option>
            </select>
          </label>
          {titleId === "new" && <div className="new-title">
            <label>New job title<input name="new_job_title" required maxLength={80} autoFocus placeholder="e.g. Data engineer" /></label>
            <label className="checkbox-label"><input type="checkbox" name="new_job_title_can_lead" checked={newTitleCanLead} onChange={(e) => setNewTitleCanLead(e.target.checked)} /> Managerial: can lead a team</label>
          </div>}
          {admin ? <p className="field-help">Super admins are not part of a team.</p> : <>
            <label>Team
              <select name="team_id" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">No team</option>
                {directory.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="checkbox-label" title={canLead ? undefined : "Needs a team and a managerial job title"}>
              <input type="checkbox" name="team_lead" checked={lead && canLead} disabled={!canLead} onChange={(e) => setLead(e.target.checked)} /> Leads this team
            </label>
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
