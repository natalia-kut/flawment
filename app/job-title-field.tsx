"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./job-title-field.module.css";

/**
 * The job title: type to narrow a short, scrolling list of titles, or type a name
 * that is not on it to add it as a new one. Replaces a native select, whose popup
 * grows with every title added and cannot be given a height.
 */
export default function JobTitleField({ titles, value, onChange, isNew }: {
  titles: { id: number; name: string }[]; value: string; onChange: (value: string) => void; isNew: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // After "+ Add a new job title…" the empty box asks for the new name.
  const [adding, setAdding] = useState(false);
  const query = value.trim().replace(/\s+/g, " ").toLowerCase();
  // A title already chosen shows the whole list, so another one is easy to pick.
  const exact = titles.some((t) => t.name.toLowerCase() === query);
  const matches = !query || exact ? titles : titles.filter((t) => t.name.toLowerCase().includes(query));
  // The last row always offers a new title: the typed one, or an empty box to type it in.
  const options: ({ kind: "title"; id: number; name: string } | { kind: "add" })[] =
    [...matches.map((t) => ({ kind: "title" as const, ...t })), { kind: "add" }];
  const expanded = open && !(adding && !query);
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active]);
  function choose(option: (typeof options)[number]) {
    setActive(-1);
    if (option.kind === "title") { onChange(option.name); setAdding(false); setOpen(false); }
    else if (query && !exact) setOpen(false); // The typed name is already the new title.
    else { onChange(""); setAdding(true); inputRef.current?.focus(); }
  }

  return <div className={styles.field}>
    <label>Job title
      <input ref={inputRef} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={id + "-list"}
        aria-activedescendant={expanded && active >= 0 ? id + "-" + active : undefined}
        maxLength={80} autoComplete="off" placeholder={adding ? "Type the new job title" : "No job title"} value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={() => { setOpen(false); setAdding(false); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            setActive((i) => e.key === "ArrowDown" ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0));
          } else if (e.key === "Enter" && expanded && active >= 0) {
            e.preventDefault(); choose(options[active]);
          } else if (e.key === "Escape" && expanded) {
            // Close the list, not the whole dialog.
            e.preventDefault(); e.stopPropagation(); setOpen(false);
          }
        }} />
    </label>
    {expanded && <ul ref={listRef} id={id + "-list"} role="listbox" aria-label="Job titles" className={styles.list}>
      {options.map((option, index) => <li key={option.kind === "title" ? option.id : "add"} id={id + "-" + index} role="option"
        aria-selected={index === active}
        className={option.kind === "add" ? styles.add : option.name.toLowerCase() === query ? styles.chosen : undefined}
        onMouseDown={(e) => e.preventDefault()} onClick={() => choose(option)} onMouseEnter={() => setActive(index)}>
        {option.kind === "title" ? option.name
          : query && !exact ? <>+ Add &ldquo;{value.trim()}&rdquo; as a new job title</> : "+ Add a new job title…"}
      </li>)}
    </ul>}
    {isNew && <p className="field-help">&ldquo;{value.trim()}&rdquo; will be added as a new job title.</p>}
  </div>;
}
