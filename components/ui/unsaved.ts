"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfirm, type ConfirmOptions } from "./confirm";

const LEAVE: ConfirmOptions = {
  title: "Leave without saving?",
  message: "What you typed here is not saved yet and will be lost.",
  confirm: "Leave",
};
const DISCARD: ConfirmOptions = {
  title: "Discard your changes?",
  message: "What you changed here is not saved yet and will be lost.",
  confirm: "Discard",
};

// Everything on the page with unsaved work, each with the confirm dialog it can ask with.
const guards = new Set<object>();
let asker: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Asks before navigation that would drop unsaved work. For moves that are not
 * links, such as the sidebar's buttons: `if (await confirmLeave()) router.push(…)`.
 */
export async function confirmLeave() {
  return guards.size === 0 || !asker || asker(LEAVE);
}

/**
 * While `dirty`, leaving the page asks first: a reload, closing the tab, a
 * link inside the app (breadcrumbs, "Open task page") and `confirmLeave()`.
 */
export function useLeaveGuard(dirty: boolean) {
  const ask = useConfirm();
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const token = {};
    guards.add(token);
    asker = ask;
    // The browser's own question; it shows no custom text.
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    // Captured on the document, so it runs before Next's <Link> navigates.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.origin !== location.origin || link.href === location.href) return;
      event.preventDefault();
      event.stopPropagation();
      void ask(LEAVE).then((ok) => { if (ok) router.push(link.pathname + link.search + link.hash); });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      guards.delete(token);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, ask, router]);
}

/** A close for a dialog with a form: asks first when something is unsaved. */
export function useGuardedClose(dirty: boolean, close: () => void) {
  const ask = useConfirm();
  return () => {
    if (!dirty) close();
    else void ask(DISCARD).then((ok) => { if (ok) close(); });
  };
}
