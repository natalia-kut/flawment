"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { profileAction, profileFieldAction } from "@/lib/profiles/actions";
import type { ProfileField } from "@/lib/profiles/service";
import { MAX_PHOTO_BYTES, MAX_SKILLS } from "@/lib/profiles/limits";
import type { Availability } from "@/lib/time-off/availability";
import type { Status } from "@/lib/status/status";
import { absenceTypeLabels } from "@/lib/time-off/labels";
import { daySpan, formatBirthday, formatRange } from "@/lib/time-off/dates";
import type { AbsenceType } from "@/src/generated/prisma/enums";
import UserAvatar from "./user-avatar";
import AvailabilityBadge from "./availability-badge";
import StatusDialog, { StatusText } from "./status-dialog";
import PageHeader from "@/components/page-header";
import EmailText from "./email-text";

type Person = { id: number; first_name: string; last_name: string; photoVersion: string | null };

/** Everything on this page saves where you edit it: no form, no Save button. */
export default function ProfileView({ user, today }: { today: string; user: {
  id: number; first_name: string; last_name: string; email: string; username: string; role: string;
  photoVersion: string | null; teamLead: boolean;
  jobTitle: string; pronouns: string; phone: string; location: string; workingHours: string; skills: string[];
  birthDate: string; availability: Availability; status: Status | null;
  nextTimeOff: { type: AbsenceType; start: string; end: string } | null;
  team: { name: string; leads: Person[]; members: Person[] } | null;
} }) {
  const [photo, setPhotoState] = useState<{ file: File; url: string } | null>(null);
  const setPhoto = usePhotoPreview(setPhotoState);
  const [editingStatus, setEditingStatus] = useState(false);
  // Remounts the file input after an upload, so it forgets the chosen file.
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [state, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof profileAction>>, data: FormData) => {
    const result = await profileAction(previous, data);
    setPhoto(null);
    setPhotoInputKey((k) => k + 1);
    return result;
  }, {});

  function choosePhoto(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) { window.alert("Choose a photo no larger than 2 MB."); setPhotoInputKey((k) => k + 1); return; }
    setPhoto(file); // Shown while it uploads.
    input.form?.requestSubmit();
  }

  // Job title and team (when set), then the username; the account type is shown elsewhere.
  const handle = ["@" + user.username, user.team?.name].filter(Boolean).join(" · ");
  const nextDays = user.nextTimeOff ? daySpan(user.nextTimeOff.start, user.nextTimeOff.end) : 0;

  return <section className="profile-page">
    <PageHeader title="My profile" />

    <section className="workspace-card profile-hero">
      <div className="profile-hero-photo">
        <form action={action} className={`profile-avatar-wrap${pending ? " uploading" : ""}`}>
          {photo
            ? <span className="user-avatar" style={{ width: 128, height: 128 }}>
              {/* A local blob preview, which next/image cannot load. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" />
            </span>
            : <UserAvatar id={user.id} firstName={user.first_name} lastName={user.last_name} photoVersion={user.photoVersion} size={128} />}
          <label className="photo-button" title={`${user.photoVersion ? "Change photo" : "Upload photo"}: JPEG, PNG or WebP up to 2 MB`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            <span className="visually-hidden">{user.photoVersion ? "Change photo" : "Upload photo"}</span>
            <input key={photoInputKey} name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden"
              aria-describedby="photo-help" disabled={pending} onChange={(event) => choosePhoto(event.currentTarget)} />
          </label>
        </form>
        {/* Hangs under the circle without adding to its height, so the name centres on the photo. */}
        <div className="profile-photo-actions">
        {user.photoVersion && !photo && <form action={action} onSubmit={(e) => { if (!window.confirm("Remove your profile photo?")) e.preventDefault(); }}>
          <input type="hidden" name="remove_photo" value="on" />
          <button className="text-button muted" disabled={pending}>Remove photo</button>
        </form>}
        {pending && <p className="field-help" role="status">Saving photo…</p>}
        {state.error && <p role="alert" className="form-error">{state.error}</p>}
        </div>
      </div>

      <div className="profile-hero-main">
        <h2>{user.first_name} {user.last_name}{user.pronouns && <span className="profile-pronouns">{user.pronouns}</span>}</h2>
        {/* Job titles come from the list a super admin manages on the People page. */}
        <p className="profile-job-title">{user.jobTitle || <span className="muted-value">{user.role === "SUPER_ADMIN" ? "No job title yet · set it on the People page" : "No job title yet · set by your administrator"}</span>}</p>
        <p className="profile-hero-subtitle">{handle}</p>
        {/* Right now: your status and whether you are away, side by side. */}
        <div className="profile-hero-meta">
        <button type="button" className="status-trigger profile-status" onClick={() => setEditingStatus(true)}>
          {user.status ? <StatusText status={user.status} withUntil /> : <span className="status-placeholder"><span aria-hidden="true">🙂</span>Set a status</span>}
          <svg className="inline-field-pencil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
        </button>
          {user.availability ? <AvailabilityBadge availability={user.availability} /> : <span className="availability-badge available">Available</span>}
          {user.teamLead && <span className="role-badge">Team lead</span>}
        </div>
        <p id="photo-help" className="visually-hidden">JPEG, PNG or WebP up to 2 MB, cropped to a square.</p>
      </div>

      <ul className="profile-contact">
        <li className="profile-contact-static">
          <ContactIcon><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></ContactIcon>
          <span className="visually-hidden">Email: </span><span className="contact-value"><EmailText email={user.email} /></span>
        </li>
        <InlineField field="phone" label="Phone" type="tel" value={user.phone} placeholder="+48 600 000 000"
          icon={<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />} />
        <InlineField field="location" label="Location" value={user.location} placeholder="e.g. Warsaw office · Remote"
          icon={<><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>} />
        <InlineField field="working_hours" label="Working hours" value={user.workingHours} placeholder="e.g. Mon–Fri, 9:00–17:00"
          icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
        <InlineField field="birth_date" label="Birthday" type="date" value={user.birthDate} max={today}
          display={(value) => formatBirthday(value)} hint="Colleagues see the day and month only"
          icon={<><path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M12 12V8M12 5.5v-.5" /><path d="M5 16c2 1.3 3.5 1.3 5 0s3-1.3 5 0 3 1.3 4 0" /></>} />
        <InlineField field="pronouns" label="Pronouns" value={user.pronouns} placeholder="e.g. she/her"
          icon={<><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>} />
      </ul>

      {/* A full-width row along the bottom of the card. */}
      <div className="profile-hero-skills">
        <span className="profile-field-label" id="skills-label">Skills</span>
        <InlineSkills skills={user.skills} />
      </div>
    </section>

    <div className="profile-layout">
      {/* Team and Time off side by side, at one height. */}
      <div className="profile-sidebar">
        <section className="workspace-card profile-mini-card">
          <div className="profile-card-head"><h2>Team</h2><Link href="/?view=team" className="inline-link">Open team page</Link></div>
          {user.role === "SUPER_ADMIN" ? <p>Super admins are not part of a team. You manage teams on the Team page.</p>
            : !user.team ? <p>You are not in a team yet. Your administrator assigns teams.</p>
            : <dl className="profile-facts">
              <div><dt>Team</dt><dd>{user.team.name}</dd></div>
              <div><dt>Reports to</dt><dd>{user.team.leads.length
                ? <ul className="mini-people">{user.team.leads.map((lead) => <li key={lead.id}><UserAvatar id={lead.id} firstName={lead.first_name} lastName={lead.last_name} photoVersion={lead.photoVersion} size={24} />{lead.first_name} {lead.last_name}</li>)}</ul>
                : <span className="muted-value">{user.teamLead ? "You lead this team" : "No team lead yet"}</span>}</dd></div>
              <div><dt>Teammates</dt><dd>
                <ul className="avatar-stack" aria-label="Teammates">{user.team.members.slice(0, 6).map((m) => <li key={m.id} title={`${m.first_name} ${m.last_name}`}>
                  <UserAvatar id={m.id} firstName={m.first_name} lastName={m.last_name} photoVersion={m.photoVersion} size={26} />
                  <span className="visually-hidden">{m.first_name} {m.last_name}</span></li>)}</ul>
                {user.team.members.length > 6 && <span className="muted-value">+{user.team.members.length - 6}</span>}
              </dd></div>
            </dl>}
        </section>

        <section className="workspace-card profile-mini-card">
          <div className="profile-card-head"><h2>Time off</h2><Link href="/?view=time-off" className="inline-link">Manage time off</Link></div>
          {user.nextTimeOff ? <p className={`profile-next-off ${user.nextTimeOff.type.toLowerCase()}`}>
            <small>{user.nextTimeOff.start <= today ? "Now" : "Next"}</small>
            <strong>{formatRange(user.nextTimeOff.start, user.nextTimeOff.end)}</strong>
            <span>{absenceTypeLabels[user.nextTimeOff.type]} · {nextDays} {nextDays === 1 ? "day" : "days"}</span>
          </p> : <p>Nothing planned.</p>}
        </section>
      </div>
    </div>
    {editingStatus && <StatusDialog status={user.status} onClose={() => setEditingStatus(false)} />}
  </section>;
}

function ContactIcon({ children }: { children: ReactNode }) {
  return <svg className="contact-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

/**
 * A contact detail you edit where you read it: click (or double-click) the row,
 * then Enter or clicking away saves it on its own, and Escape cancels.
 */
function InlineField({ field, label, value, icon, type = "text", placeholder, max, display = (v) => v, hint }: {
  field: ProfileField; label: string; value: string; icon: ReactNode;
  type?: "text" | "tel" | "date"; placeholder?: string; max?: string; display?: (value: string) => string; hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const [state, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof profileFieldAction>>, data: FormData) => {
    const result = await profileFieldAction(previous, data);
    if (!result.error) setEditing(false);
    return result;
  }, {});

  function finish() {
    if (pending) return;
    if (cancelled.current) { cancelled.current = false; setEditing(false); return; }
    if (input.current && input.current.value.trim() !== value) input.current.form?.requestSubmit();
    else setEditing(false);
  }

  if (!editing) return <li>
    <button type="button" className="inline-field" onClick={() => setEditing(true)} title={hint ?? `Edit ${label.toLowerCase()}`}>
      <ContactIcon>{icon}</ContactIcon>
      <span className="visually-hidden">{label}: </span>
      {value ? <span className="contact-value">{display(value)}</span> : <span className="muted-value">Add {label.toLowerCase()}</span>}
      <svg className="inline-field-pencil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
    </button>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </li>;

  return <li>
    <form action={action} className="inline-field-form">
      <input type="hidden" name="field" value={field} />
      <ContactIcon>{icon}</ContactIcon>
      <input ref={input} name="value" type={type} defaultValue={value} placeholder={placeholder} max={max} min={type === "date" ? "1900-01-01" : undefined}
        aria-label={label} autoFocus disabled={pending}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
        }} />
    </form>
    {hint && <p className="field-help">{hint}</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </li>;
}

/** Skills as chips: add with Enter or a comma, remove with ×. Each change saves straight away. */
function InlineSkills({ skills }: { skills: string[] }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [state, action, pending] = useActionState(profileFieldAction, {});
  function save(next: string[]) {
    const data = new FormData();
    data.set("field", "skills");
    data.set("value", next.join(","));
    startTransition(() => action(data));
  }
  function add(values: string[]) {
    const next = [...skills];
    for (const value of values) {
      const skill = value.trim().replace(/\s+/g, " ").slice(0, 30);
      if (skill && next.length < MAX_SKILLS && !next.some((s) => s.toLowerCase() === skill.toLowerCase())) next.push(skill);
    }
    if (next.length !== skills.length) save(next);
  }
  return <div className="profile-skills-inline">
    <ul className="skill-list" aria-labelledby="skills-label">
      {skills.map((skill) => <li key={skill} className="skill-chip">{skill}
        <button type="button" disabled={pending} onClick={() => save(skills.filter((s) => s !== skill))} aria-label={`Remove ${skill}`}>×</button>
      </li>)}
      {skills.length < MAX_SKILLS && <li>{adding
        ? <input className="skill-add-input" value={draft} maxLength={30} autoFocus disabled={pending} aria-label="Add a skill" placeholder="Skill, then Enter"
          onChange={(e) => {
            // Typing or pasting a comma turns everything before it into skills.
            const parts = e.target.value.split(",");
            if (parts.length > 1) { add(parts.slice(0, -1)); setDraft(parts.at(-1)!); } else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add([draft]); setDraft(""); }
            if (e.key === "Escape") { setDraft(""); setAdding(false); }
          }}
          onBlur={() => { if (draft.trim()) add([draft]); setDraft(""); setAdding(false); }} />
        : <button type="button" className="skill-add" onClick={() => setAdding(true)}>+ {skills.length ? "Add skill" : "Add your skills"}</button>}
      </li>}
    </ul>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </div>;
}

/**
 * Wraps the photo setter so each chosen file gets an object URL for the
 * preview, and the previous URL is released (also when the page unmounts).
 */
function usePhotoPreview(set: (photo: { file: File; url: string } | null) => void) {
  const current = useRef<string | null>(null);
  useEffect(() => () => { if (current.current) URL.revokeObjectURL(current.current); }, []);
  return (file: File | null) => {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = file ? URL.createObjectURL(file) : null;
    set(file && current.current ? { file, url: current.current } : null);
  };
}
