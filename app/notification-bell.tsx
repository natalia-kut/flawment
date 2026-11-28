"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { markReadAction } from "@/lib/notifications/actions";
import { notificationHref, notificationText, type NotificationItem } from "@/lib/notifications/labels";
import { reach } from "@/components/ui/offline";

async function fetchNotifications(): Promise<{ unread: number; items: NotificationItem[] }> {
  const response = await fetch("/api/notifications", { cache: "no-store" });
  if (!response.ok) throw new Error(`Notifications: ${response.status}`);
  return response.json();
}

/** How often to look for news while the app is on screen. */
const POLL_MS = 60_000;
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(iso: string, now = Date.now()) {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

/**
 * The bell above the account button: what happened to your work while you were
 * elsewhere. It asks for news when it mounts, every minute while the tab is
 * visible, when the tab comes back, and when it opens.
 */
export default function NotificationBell({ compact }: { compact: boolean }) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ unread: number; items: NotificationItem[] } | null>(null);
  const [failed, setFailed] = useState(false);

  // The state is set once the answer arrives, never while an effect runs.
  const load = useCallback(() => fetchNotifications().then(
    (fresh) => { setData(fresh); setFailed(false); },
    () => setFailed(true),
  ), []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  // Like the account menu: beside the narrow sidebar, above the button at its foot, or below it on phones.
  function place() {
    const box = button.current!.getBoundingClientRect(), style = panel.current!.style;
    style.top = style.bottom = style.left = "auto";
    if (compact) {
      style.left = `${box.right + 10}px`;
      style.bottom = `${Math.max(12, window.innerHeight - box.bottom)}px`;
    } else if (box.top > 280) {
      style.left = `${box.left}px`;
      style.bottom = `${window.innerHeight - box.top + 8}px`;
    } else {
      style.left = `${Math.max(12, Math.min(box.left, window.innerWidth - 372))}px`;
      style.top = `${box.bottom + 8}px`;
    }
    void load();
  }

  async function markRead(ids: number[] | "all") {
    // Shown at once; the next load corrects it if saving failed.
    setData((current) => current && {
      unread: ids === "all" ? 0 : Math.max(0, current.unread - current.items.filter((item) => !item.read && ids.includes(item.id)).length),
      items: current.items.map((item) => ids === "all" || ids.includes(item.id) ? { ...item, read: true } : item),
    });
    await reach(() => markReadAction(ids), { error: "offline" });
  }

  const unread = data?.unread ?? 0;
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  return <>
    <button ref={button} type="button" className="nav-link notification-button" popoverTarget="notification-panel" onClick={place}
      aria-label={compact ? label : undefined} title={compact ? label : undefined}>
      <span className="notification-icon">
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" /></svg>
        {unread > 0 && compact && <span className="notification-dot" aria-hidden="true" />}
      </span>
      <span className="sidebar-label">Notifications</span>
      {unread > 0 && !compact && <span className="notification-count sidebar-label" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>}
    </button>
    <div ref={panel} id="notification-panel" popover="auto" className="account-menu notification-panel" aria-label="Notifications">
      <div className="notification-head">
        <strong>Notifications</strong>
        {unread > 0 && <button type="button" className="text-button" onClick={() => markRead("all")}>Mark all read</button>}
      </div>
      {failed && !data && <p className="notification-empty">Could not load notifications. They will be tried again shortly.</p>}
      {data && data.items.length === 0 && <p className="notification-empty">Nothing new. Assignments, comments and status changes on your tasks show up here.</p>}
      {data && data.items.length > 0 && <ul className="notification-list">
        {data.items.map((item) => {
          const { who, text, what } = notificationText(item);
          return <li key={item.id} className={item.read ? undefined : "unread"}>
            <Link href={notificationHref(item)} onClick={() => { if (!item.read) void markRead([item.id]); panel.current?.hidePopover(); }}>
              <span><strong>{who}</strong> {text} <strong>{what}</strong></span>
              <small>{ago(item.createdAt)}</small>
            </Link>
          </li>;
        })}
      </ul>}
    </div>
  </>;
}
