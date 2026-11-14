"use client";

import { useActionState, useState } from "react";
import PageHeader from "@/components/page-header";
import { timeOffAction, type TimeOffState } from "@/lib/time-off/actions";
import { absenceTypeLabels } from "@/lib/time-off/labels";
import { daySpan, formatRange } from "@/lib/time-off/dates";
import type { AbsenceType } from "@/src/generated/prisma/enums";
import { useConfirmSubmit } from "@/components/ui/confirm";

type Entry = { id: number; type: AbsenceType; start_date: string; end_date: string; note: string | null };

export default function TimeOffView({ upcoming, past, today }: { upcoming: Entry[]; past: Entry[]; today: string }) {
  return <section className="time-off-page">
    <PageHeader title="Time off" />
    <div className="time-off-layout">
      <AddTimeOff today={today} />
      {/* As tall as the form beside it; the list scrolls inside instead of growing the page. */}
      <section className="workspace-card time-off-lists">
        <div className="section-heading"><div><h2>Planned</h2><p>Current and upcoming time off.</p></div></div>
        <div className="time-off-scroll" tabIndex={0} aria-label="Your time off">
          {upcoming.length === 0
            ? <p className="time-off-empty">Nothing planned. Add your next day off on the left.</p>
            : <ul className="time-off-list">{upcoming.map((entry) => <TimeOffItem key={entry.id} entry={entry} today={today} />)}</ul>}
          {past.length > 0 && <details className="time-off-past">
            <summary>Past time off <span className="role-badge">{past.length}</span></summary>
            <ul className="time-off-list">{past.map((entry) => <TimeOffItem key={entry.id} entry={entry} today={today} />)}</ul>
          </details>}
        </div>
      </section>
    </div>
  </section>;
}

function AddTimeOff({ today }: { today: string }) {
  const empty = { type: "VACATION" as AbsenceType, start: today, end: today, note: "" };
  const [fields, setFields] = useState(empty);
  const [state, action, pending] = useActionState(async (previous: TimeOffState, data: FormData) => {
    const result = await timeOffAction(previous, data);
    if (result.success) setFields(empty);
    return result;
  }, {});
  const days = fields.start && fields.end && fields.end >= fields.start ? daySpan(fields.start, fields.end) : 0;

  return <form action={action} className="workspace-card time-off-form">
    <input type="hidden" name="operation" value="create" />
    <h2>Add time off</h2>
    <p className="field-help">Colleagues see only that you are away. Your team lead also sees the type; your note stays private.</p>
    <fieldset disabled={pending}>
      <div className="type-choices" role="radiogroup" aria-label="Type">
        {(Object.keys(absenceTypeLabels) as AbsenceType[]).map((type) => <label key={type} className={`type-choice ${type.toLowerCase()}`}>
          <input type="radio" name="type" value={type} checked={fields.type === type} onChange={() => setFields((f) => ({ ...f, type }))} />
          <span>{absenceTypeLabels[type]}</span>
        </label>)}
      </div>
      <div className="form-row">
        <label>First day<input name="start_date" type="date" required value={fields.start}
          onChange={(e) => setFields((f) => ({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end }))} /></label>
        <label>Last day<input name="end_date" type="date" required min={fields.start} value={fields.end}
          onChange={(e) => setFields((f) => ({ ...f, end: e.target.value }))} /></label>
      </div>
      <label><span>Note <span className="optional-label">optional · only you see it</span></span>
        <input name="note" maxLength={200} value={fields.note} placeholder="e.g. Family trip" onChange={(e) => setFields((f) => ({ ...f, note: e.target.value }))} />
      </label>
      <div className="time-off-form-footer">
        <span className="time-off-summary">{days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : "Check the dates"}</span>
        <button className="primary-button" disabled={!days || pending}>{pending ? "Saving…" : "Add time off"}</button>
      </div>
    </fieldset>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="form-success" role="status">{state.success}</p>}
  </form>;
}

function TimeOffItem({ entry, today }: { entry: Entry; today: string }) {
  const [state, action, pending] = useActionState(timeOffAction, {});
  const confirmSubmit = useConfirmSubmit();
  const days = daySpan(entry.start_date, entry.end_date);
  const now = entry.start_date <= today && entry.end_date >= today;
  return <li className={`time-off-item ${entry.type.toLowerCase()}`}>
    <div>
      <strong>{formatRange(entry.start_date, entry.end_date)}{now && <span className="now-badge">Now</span>}</strong>
      <small>{absenceTypeLabels[entry.type]} · {days} {days === 1 ? "day" : "days"}</small>
      {entry.note && <p>{entry.note}</p>}
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </div>
    <form action={action} onSubmit={confirmSubmit({ title: "Remove this time off?", message: `${formatRange(entry.start_date, entry.end_date)} will no longer show you as away.`, confirm: "Remove" })}>
      <input type="hidden" name="operation" value="delete" />
      <input type="hidden" name="absence_id" value={entry.id} />
      <button className="icon-button" disabled={pending} aria-label={`Remove time off ${formatRange(entry.start_date, entry.end_date)}`} title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
    </form>
  </li>;
}
