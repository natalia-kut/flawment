"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function TaskDetailsDialog({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="project-dialog" aria-labelledby="task-details-title"
    onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="project-dialog-content">
      <div className="project-dialog-heading">
        <h2 id="task-details-title">{title}</h2>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close task details">×</button>
      </div>
      {children}
    </div>
  </dialog>;
}
