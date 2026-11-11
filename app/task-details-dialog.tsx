"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A modal for one task. `heading` replaces the plain title, e.g. with an editable field. */
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
    return () => dialog.close();
  }, [focusFirstField]);
  return <dialog ref={ref} className="project-dialog" aria-label={title} tabIndex={-1} style={{ outline: "none" }}
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
