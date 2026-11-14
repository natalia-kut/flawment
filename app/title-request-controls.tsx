"use client";

import { useActionState, useState } from "react";
import { titleRequestAction, type TitleRequestState } from "@/lib/job-title-requests/actions";
import type { LeadTitleRequests } from "@/lib/job-title-requests/data";
import type { TeamPerson } from "@/lib/teams/data";
import JobTitleField from "./job-title-field";
import styles from "./title-request-controls.module.css";

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Warsaw" });

/**
 * On a team member's card, for their team lead: suggest a new job title for a
 * super admin to approve, or see where the last suggestion stands.
 */
export default function TitleRequestControls({ person, request, jobTitles }: {
  person: TeamPerson; request?: LeadTitleRequests["byPerson"][number]; jobTitles: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [state, action, pending] = useActionState(async (previous: TitleRequestState, data: FormData) => {
    const result = await titleRequestAction(previous, data);
    if (result.success) { setOpen(false); setTitle(""); }
    return result;
  }, {});
  const isNew = !!title.trim() && !jobTitles.some((t) => t.name.toLowerCase() === title.trim().toLowerCase());

  if (request?.status === "PENDING") return <form action={action} className={styles.status} data-state="pending">
    <span aria-hidden="true">⏳</span>
    <p>Suggested <strong>{request.title}</strong>. Waiting for an administrator to approve it.</p>
    <input type="hidden" name="operation" value="cancel" /><input type="hidden" name="request_id" value={request.id} />
    {request.mine && <button className="text-button" disabled={pending}>Withdraw</button>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;

  return <div className={styles.controls}>
    {request && !open && <p className={styles.last} data-approved={request.status === "APPROVED" || undefined}>
      {request.status === "APPROVED" ? "Approved" : "Declined"}: {request.title}
      {request.decidedAt && <> · {dayMonth.format(new Date(request.decidedAt))}</>}
    </p>}
    {open ? <form action={action} className={styles.form}>
      <input type="hidden" name="operation" value="request" /><input type="hidden" name="user_id" value={person.id} />
      <input type="hidden" name="title" value={title} />
      <fieldset disabled={pending}>
        <JobTitleField titles={jobTitles} value={title} onChange={setTitle} label={`New job title for ${person.first_name}`}
          placeholder={person.jobTitle ?? "Pick or type a job title"}
          hint={isNew && "Not on the list yet: it will be added if approved."} />
        <label><span>Why? <span className={styles.optional}>optional</span></span>
          <textarea name="note" maxLength={300} rows={2} placeholder="e.g. Took over the backend after the review" />
        </label>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="primary-button" disabled={!title.trim()}>{pending ? "Sending…" : "Send to an administrator"}</button>
        </div>
      </fieldset>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
      : <button type="button" className="secondary-button" onClick={() => setOpen(true)}>Suggest a new job title</button>}
  </div>;
}
