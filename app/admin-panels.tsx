"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { TeamPerson } from "@/lib/teams/data";
import type { PendingTitleRequest } from "@/lib/job-title-requests/data";
import { titleRequestAction, type TitleRequestState } from "@/lib/job-title-requests/actions";
import UserAvatar from "./user-avatar";
import dashboard from "./dashboard.module.css";
import styles from "./admin-panels.module.css";
import { closeOnBackdrop } from "@/components/ui/backdrop";
import { OFFLINE, reach } from "@/components/ui/offline";

export type AdminData = { requests: PendingTitleRequest[]; people: TeamPerson[]; teams: { id: number; name: string; members: TeamPerson[] }[] };

/** Who still needs a job title or a team, and which teams have no lead. */
export function setupNeeds({ people, teams }: AdminData) {
  return {
    noTitle: people.filter((p) => p.jobTitle === null),
    noTeam: people.filter((p) => p.teamId === null),
    leaderless: teams.filter((t) => !t.members.some((p) => p.teamLead)),
  };
}

/** "today", "yesterday" or "3 days ago", counted in workspace days. */
const ago = (day: string, today: string) => {
  const days = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

/** Requests to decide, then gaps to fill: one quiet row each; "all caught up" when there are none. */
export default function NeedsYou({ requests, needs, today }: { requests: PendingTitleRequest[]; needs: ReturnType<typeof setupNeeds>; today: string }) {
  const unset = [...new Set([...needs.noTitle, ...needs.noTeam])];
  const count = requests.length + unset.length + needs.leaderless.length;
  return <section className={dashboard.panel} id="title-requests" aria-labelledby="needs-title">
    <div className={dashboard.panelHeading}><h2 id="needs-title">Needs you{count > 0 && <> <span className="role-badge">{count}</span></>}</h2></div>
    {count === 0 ? <p className={styles.caughtUp}><span aria-hidden="true">🎉</span> You&apos;re all caught up: no requests, and everyone is set up.</p>
    : <ul className={styles.list}>
      {requests.map((r) => <RequestRow key={r.id} request={r} today={today} />)}
      {unset.map((p) => <li key={p.id} className={styles.row}>
        <UserAvatar id={p.id} firstName={p.first_name} lastName={p.last_name} photoVersion={p.photoVersion} size={36} />
        <div className={styles.body}>
          <p><strong>{p.first_name} {p.last_name}</strong></p>
          <p className={styles.missing}>{[p.jobTitle === null && "No job title", p.teamId === null && "No team"].filter(Boolean).join(" · ")}</p>
        </div>
        <Link className={styles.fix} href="/?view=team">Set up →</Link>
      </li>)}
      {needs.leaderless.map((t) => <li key={"team-" + t.id} className={styles.row}>
        <span className={styles.teamMark} aria-hidden="true">{t.name.split(/\s+/).map((w) => w[0]).filter((c) => /\w/.test(c)).join("").slice(0, 2)}</span>
        <div className={styles.body}>
          <p><strong>{t.name}</strong></p>
          <p className={styles.missing}>No team lead</p>
        </div>
        <Link className={styles.fix} href={`/?view=team&team=${t.id}`}>Pick a lead →</Link>
      </li>)}
    </ul>}
  </section>;
}

/** A request as one short row; the whole of it, and the decision, open in a dialog. */
function RequestRow({ request: r, today }: { request: PendingTitleRequest; today: string }) {
  const [open, setOpen] = useState(false);
  return <li>
    <button type="button" className={`${styles.row} ${styles.open}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <UserAvatar id={r.personId} firstName={r.firstName} lastName={r.lastName} photoVersion={r.photoVersion} size={36} />
      <span className={styles.body}>
        <strong>{r.person}</strong>
        <span className={styles.change}>{r.currentTitle ?? "No job title"} <span aria-hidden="true">→</span><span className="visually-hidden"> to </span> <b className={styles.to}>{r.title}</b></span>
      </span>
      <span className={styles.fix}>Review →</span>
    </button>
    {open && <RequestDialog request={r} today={today} onClose={() => setOpen(false)} />}
  </li>;
}

/** Everything about one request, the reason in full, and Approve or Decline. */
function RequestDialog({ request: r, today, onClose }: { request: PendingTitleRequest; today: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const [state, action, pending] = useActionState(async (previous: TitleRequestState, data: FormData) => {
    const result = await reach(() => titleRequestAction(previous, data), { error: OFFLINE });
    if (result.success) onClose();
    return result;
  }, {});
  function decide(operation: "approve" | "decline") {
    const data = new FormData();
    data.set("operation", operation);
    data.set("request_id", String(r.id));
    // What this dialog shows: refused if the lead has changed the suggestion since.
    data.set("expected_title", r.title);
    startTransition(() => action(data));
  }
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={`request-${r.id}-title`} onCancel={onClose}
    {...closeOnBackdrop(onClose)}>
    <div className={styles.dialogHead}>
      <UserAvatar id={r.personId} firstName={r.firstName} lastName={r.lastName} photoVersion={r.photoVersion} size={44} />
      <div>
        <h2 id={`request-${r.id}-title`}>{r.person}</h2>
        <p>{r.team ?? "No team"}</p>
      </div>
      <button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">×</button>
    </div>
    <p className={styles.dialogChange}>
      <span className={styles.from}>{r.currentTitle ?? "No job title"}</span>
      <span aria-hidden="true">→</span><span className="visually-hidden"> to </span>
      <strong className={styles.to}>{r.title}</strong>
    </p>
    {(r.isNewTitle || r.canLead) && <p className={styles.tags}>{[r.isNewTitle && "New title: added to the list on approval", r.canLead && "Can lead a team"].filter(Boolean).join(" · ")}</p>}
    {r.note && <blockquote className={styles.reason}>{r.note}</blockquote>}
    <p className={styles.meta}>Suggested by {r.requester}, {ago(r.createdOn, today)}</p>
    {r.endsLead && <p className={styles.warn}>Approving ends their team lead role.</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <div className={styles.dialogActions}>
      <button type="button" className="secondary-button" disabled={pending} onClick={() => decide("decline")}>Decline</button>
      <button type="button" className="primary-button" disabled={pending} onClick={() => decide("approve")}>{pending ? "Saving…" : "Approve"}</button>
    </div>
  </dialog>;
}
