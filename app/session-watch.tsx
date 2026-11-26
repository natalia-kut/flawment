"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Shared by every tab of this browser: who the workspace pages are signed in as ("" when signed out). */
export const SESSION_KEY = "flawment:user";

// setTimeout overflows past about 24.8 days; a refresh a day is plenty for far-off expiries.
const MAX_WAIT = 24 * 60 * 60 * 1000;

/**
 * Keeps an open workspace tab honest about two things that change behind it:
 *  - the account: signing in as someone else (or out) in another tab makes this
 *    one act for the new cookie, so it stops and asks for a reload instead;
 *  - statuses: one that has run out is hidden by refreshing at its end time.
 */
export default function SessionWatch({ userId, statusEnds }: { userId: number; statusEnds: (string | null)[] }) {
  const router = useRouter();
  const [switched, setSwitched] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const me = String(userId);
    localStorage.setItem(SESSION_KEY, me);
    // Another tab signed in or out: the "storage" event fires only in the other tabs.
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY && event.newValue !== me) setSwitched(true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  useEffect(() => {
    if (switched) dialog.current?.showModal();
  }, [switched]);

  const ends = statusEnds.filter((end): end is string => !!end).join(",");
  useEffect(() => {
    const now = Date.now();
    const next = ends.split(",").map((end) => Date.parse(end)).filter((end) => end > now).sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = setTimeout(() => router.refresh(), Math.min(next - now + 500, MAX_WAIT));
    return () => clearTimeout(timer);
  }, [ends, router]);

  if (!switched) return null;
  return <dialog ref={dialog} className="project-dialog" aria-labelledby="session-switched-title" onCancel={(event) => event.preventDefault()}>
    <div className="project-dialog-content">
      <h2 id="session-switched-title">You switched accounts in another tab</h2>
      <p>This tab still shows the account you were using before. Anything you save here now would go to the other account, so reload it first.</p>
      <div className="dialog-actions">
        <button type="button" className="primary-button" autoFocus onClick={() => location.reload()}>Reload</button>
      </div>
    </div>
  </dialog>;
}
