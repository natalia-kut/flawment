"use client";

import { useEffect, useRef, type ReactNode } from "react";
import details from "@/components/ui/details-dialog.module.css";

/** A modal for one task: what it is about on the left, its facts on the right (see `TaskDialogColumns`). `heading` replaces the plain title, e.g. with an editable field. */
export default function TaskDetailsDialog({ title, heading, focusFirstField = false, onClose, children }: {
  title: string; heading?: ReactNode; focusFirstField?: boolean; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    // Showing details: focus the dialog itself, so nothing looks "in edit" on open.
    // Creating: keep the browser's choice, the first field (the title).
    if (!focusFirstField) dialog.focus();
    // The page behind must not scroll; its scrollbar keeps its place, so nothing jumps sideways.
    const page = document.documentElement;
    const { overflow } = document.body.style, { scrollbarGutter } = page.style;
    if (window.innerWidth > page.clientWidth) page.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      page.style.scrollbarGutter = scrollbarGutter;
    };
  }, [focusFirstField]);
  return <dialog ref={ref} className={"project-dialog " + details.taskDialog} aria-label={title} tabIndex={-1} style={{ outline: "none" }}
    onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="project-dialog-content">
      <div className="project-dialog-heading">
        {heading ?? <h2>{title}</h2>}
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close task details">×</button>
      </div>
      {children}
    </div>
  </dialog>;
}

/** The dialog's two columns, each scrolling by itself, so the title and the buttons never leave the screen. */
export function TaskDialogColumns({ children, side }: { children: ReactNode; side: ReactNode }) {
  return <div className={details.columns}>
    <div className={details.mainColumn}>{children}</div>
    <div className={details.sideColumn}>{side}</div>
  </div>;
}
