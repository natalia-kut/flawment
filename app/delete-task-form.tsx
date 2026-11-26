"use client";

import { useActionState } from "react";
import { deleteTaskAction, type TaskState } from "@/lib/tasks/actions";
import { useConfirmSubmit } from "@/components/ui/confirm";
import { BinIcon } from "@/components/ui/icons";
import { OFFLINE, reach } from "@/components/ui/offline";

/** Deletes a task after a confirmation: a small bin, or a text button when there is a `label`. */
export default function DeleteTaskForm({ projectId, taskId, title, className, label, onDeleted }: {
  projectId: number; taskId: number; title: string; className?: string; label?: string; onDeleted?: () => void;
}) {
  const [state, action, pending] = useActionState(async (previous: TaskState, data: FormData) => {
    const result = await reach(() => deleteTaskAction(previous, data), { error: OFFLINE });
    if (result.success) onDeleted?.();
    return result;
  }, {});
  const confirmSubmit = useConfirmSubmit();
  return <form action={action} className={className}
    onSubmit={confirmSubmit({ title: `Delete “${title}”?`, message: "The task is removed for good. This cannot be undone.", confirm: "Delete task" })}>
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="task_id" value={taskId} />
    {label
      ? <button className="text-button danger" disabled={pending}>{pending ? "Deleting…" : label}</button>
      : <button className="icon-button" disabled={pending} aria-label={"Delete task: " + title} title="Delete task">
        <BinIcon />
      </button>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
