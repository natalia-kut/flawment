"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./tabs.module.css";

type Tab = { key: string; label: string; count?: number; content: ReactNode };

/**
 * One part of a page at a time. The open tab is in the address (?tab=…), so a refresh or a
 * shared link opens the same one; the first tab needs no parameter.
 */
export default function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const search = useSearchParams();
  const list = useRef<HTMLDivElement>(null);
  const open = tabs.find((tab) => tab.key === search.get("tab")) ?? tabs[0];

  function select(key: string) {
    const params = new URLSearchParams(search.toString());
    if (key === tabs[0].key) params.delete("tab");
    else params.set("tab", key);
    // Next.js keeps useSearchParams in step with this, without asking the server for the page again.
    window.history.replaceState(null, "", "/?" + params.toString());
  }

  function onKeyDown(event: KeyboardEvent) {
    // Alt+Left is the browser's Back, Ctrl/Meta+arrows are text and window shortcuts: not ours.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const index = tabs.indexOf(open);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].key);
    list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next].focus();
  }

  return <>
    <div className={styles.tabs} role="tablist" aria-label={label} ref={list} onKeyDown={onKeyDown}>
      {tabs.map((tab) => <button key={tab.key} type="button" role="tab" id={"tab-" + tab.key}
        // Only the open tab's panel exists, so only it is pointed at.
        aria-controls={tab === open ? "tabpanel-" + tab.key : undefined}
        aria-selected={tab === open} tabIndex={tab === open ? 0 : -1} onClick={() => select(tab.key)}>
        {tab.label}{tab.count !== undefined && <span className={styles.count}>{tab.count}</span>}
      </button>)}
    </div>
    <div role="tabpanel" key={open.key} id={"tabpanel-" + open.key} aria-labelledby={"tab-" + open.key}>{open.content}</div>
  </>;
}
