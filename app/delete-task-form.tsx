"use client";

import { useActionState } from "react";
import { deleteTaskAction } from "@/lib/tasks/actions";
import { useConfirmSubmit } from "@/components/ui/confirm";
import { BinIcon } from "@/components/ui/icons";

/** A small bin that deletes a task after a confirmation. */
export default function DeleteTaskForm({ projectId, taskId, title, className }: {
  projectId: number; taskId: number; title: string; className?: string;
}) {
  const [state, action, pending] = useActionState(deleteTaskAction, {});
  const confirmSubmit = useConfirmSubmit();
  return <form action={action} className={className}
    onSubmit={confirmSubmit({ title: `Delete “${title}”?`, message: "The task is removed for good. This cannot be undone.", confirm: "Delete task" })}>
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="task_id" value={taskId} />
    <button className="icon-button" disabled={pending} aria-label={"Delete task: " + title} title="Delete task">
      <BinIcon />
    </button>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
