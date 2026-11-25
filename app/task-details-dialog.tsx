"use client";

import type { ReactNode } from "react";
import { useModal } from "@/components/ui/use-modal";
import details from "@/components/ui/details-dialog.module.css";

/** A modal for one task: what it is about on the left, its facts on the right (see `TaskDialogColumns`). `heading` replaces the plain title, e.g. with an editable field. */
export default function TaskDetailsDialog({ title, heading, focusFirstField = false, onClose, children }: {
  title: string; heading?: ReactNode; focusFirstField?: boolean; onClose: () => void; children: ReactNode;
}) {
  const ref = useModal({ focusFirstField });
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
