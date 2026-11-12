"use client";

import { useActionState, useRef, useState } from "react";
import type { Status } from "@/lib/status/status";
import StatusDialog, { StatusText } from "./status-dialog";
import { logout } from "@/lib/auth/actions";
import type { Availability } from "@/lib/time-off/availability";
import UserAvatar from "./user-avatar";
import AvailabilityBadge from "./availability-badge";

type AccountView = "profile" | "time-off";

/**
 * The account button at the foot of the sidebar. It opens a native popover:
 * the browser handles Escape and clicks outside, and the top layer keeps the
 * menu visible even though the (collapsible) sidebar clips its overflow.
 */
export default function AccountMenu({ user, compact, onOpen }: {
  user: { id: number; first_name: string; last_name: string; role: string; photoVersion: string | null; availability: Availability; status: Status | null };
  compact: boolean;
  onOpen: (view: AccountView) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [, signOut, signingOut] = useActionState(logout, undefined);
  const [editingStatus, setEditingStatus] = useState(false);
  const role = user.role === "SUPER_ADMIN" ? "Super admin" : "Standard user";

  // Runs before the popovertarget opens the menu, so it appears in place.
  function place() {
    const box = button.current!.getBoundingClientRect(), style = menu.current!.style;
    style.top = style.bottom = style.left = "auto";
    if (compact) { // Beside the narrow sidebar, level with the button's bottom.
      style.left = `${box.right + 10}px`;
      style.bottom = `${window.innerHeight - box.bottom}px`;
    } else if (box.top > 280) { // Above the button (desktop sidebar foot).
      style.left = `${box.left}px`;
      style.bottom = `${window.innerHeight - box.top + 8}px`;
    } else { // Below it (phones, where the sidebar is a top bar).
      style.left = `${Math.max(12, Math.min(box.left, window.innerWidth - 272))}px`;
      style.top = `${box.bottom + 8}px`;
    }
  }

  function go(view: AccountView) {
    menu.current?.hidePopover();
    onOpen(view);
  }

  return <>
    <button ref={button} type="button" className="account-button" popoverTarget="account-menu" onClick={place}
      aria-label={compact ? `Account: ${user.first_name} ${user.last_name}` : undefined} title={compact ? "Account" : undefined}>
      <span className="account-avatar">
        <UserAvatar id={user.id} firstName={user.first_name} lastName={user.last_name} photoVersion={user.photoVersion} size={36} />
        {user.availability?.state === "away" && <span className="away-dot" aria-hidden="true" />}
      </span>
      <span className="profile-name sidebar-label">{user.first_name} {user.last_name}<small>{user.status ? `${user.status.emoji ?? ""} ${user.status.text}`.trim() : user.availability?.state === "away" ? "Out of office" : role}</small></span>
      <svg className="account-chevron sidebar-label" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 15 5-5 5 5" /></svg>
    </button>
    <div ref={menu} id="account-menu" popover="auto" className="account-menu">
      <div className="account-menu-header">
        <UserAvatar id={user.id} firstName={user.first_name} lastName={user.last_name} photoVersion={user.photoVersion} size={40} />
        <div><strong>{user.first_name} {user.last_name}</strong><small>{role}</small></div>
      </div>
      <div className="account-menu-status">
        <button type="button" className="status-trigger" onClick={() => { menu.current?.hidePopover(); setEditingStatus(true); }}>
          {user.status ? <StatusText status={user.status} withUntil /> : <span className="status-placeholder"><span aria-hidden="true">🙂</span>Set a status</span>}
        </button>
        {user.availability && <AvailabilityBadge availability={user.availability} />}
      </div>
      <ul>
        <li><button type="button" onClick={() => go("profile")}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
          Edit profile</button></li>
        <li><button type="button" onClick={() => go("time-off")}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
          Time off</button></li>
      </ul>
      <form action={signOut} className="account-menu-signout">
        <button type="submit" disabled={signingOut}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h10" /></svg>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </form>
    </div>
    {editingStatus && <StatusDialog status={user.status} onClose={() => setEditingStatus(false)} />}
  </>;
}
