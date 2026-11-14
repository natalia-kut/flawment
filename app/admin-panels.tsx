"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import type { TeamPerson } from "@/lib/teams/data";
import type { PendingTitleRequest } from "@/lib/job-title-requests/data";
import { titleRequestAction } from "@/lib/job-title-requests/actions";
import UserAvatar from "./user-avatar";
import dashboard from "./dashboard.module.css";
import styles from "./admin-panels.module.css";

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

/** Requests to decide, then gaps to fill: one quiet row each; a slim "all caught up" when there are none. */
export default function NeedsYou({ requests, needs, today }: { requests: PendingTitleRequest[]; needs: ReturnType<typeof setupNeeds>; today: string }) {
  const unset = [...new Set([...needs.noTitle, ...needs.noTeam])];
  const count = requests.length + unset.length + needs.leaderless.length;
  if (count === 0) return <p className={styles.caughtUp}><span aria-hidden="true">🎉</span> You&apos;re all caught up: no requests, and everyone is set up.</p>;
  return <section className={`${dashboard.panel} ${styles.needs}`} id="title-requests" aria-labelledby="needs-title">
    <div className={dashboard.panelHeading}><h2 id="needs-title">Needs you <span className="role-badge">{count}</span></h2></div>
    <ul className={styles.list}>
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
    </ul>
  </section>;
}

function RequestRow({ request: r, today }: { request: PendingTitleRequest; today: string }) {
  const [state, action, pending] = useActionState(titleRequestAction, {});
  function decide(operation: "approve" | "decline") {
    const data = new FormData();
    data.set("operation", operation);
    data.set("request_id", String(r.id));
    startTransition(() => action(data));
  }
  const tags = [r.isNewTitle && "new title", r.canLead && "can lead a team"].filter(Boolean).join(" · ");
  return <li className={styles.row} aria-busy={pending}>
    <UserAvatar id={r.personId} firstName={r.firstName} lastName={r.lastName} photoVersion={r.photoVersion} size={36} />
    <div className={styles.body}>
      <p><strong>{r.person}</strong> <span className={styles.from}>{r.currentTitle ?? "no job title"}</span>
        <span className={styles.arrow} aria-hidden="true"> → </span><span className="visually-hidden"> to </span>
        <strong className={styles.to}>{r.title}</strong>{tags && <span className={styles.tags}> · {tags}</span>}</p>
      <p className={styles.meta}>{r.note && <>&ldquo;{r.note}&rdquo; </>}{r.requester}, {ago(r.createdOn, today)}</p>
      {r.endsLead && <p className={styles.warn}>Approving ends their team lead role.</p>}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </div>
    <div className={styles.actions}>
      <button type="button" className="text-button" disabled={pending} onClick={() => decide("decline")}>Decline</button>
      <button type="button" className="primary-button" disabled={pending} onClick={() => decide("approve")}>Approve</button>
    </div>
  </li>;
}
