"use client";

import { useActionState } from "react";
import { deleteTaskAction } from "@/lib/tasks/actions";

export default function DeleteTaskForm({ projectId, taskId, title }: {
  projectId: number; taskId: number; title: string;
}) {
  const [state, action, pending] = useActionState(deleteTaskAction, {});
  return <form action={action} onSubmit={(event) => {
    if (!window.confirm('Permanently delete "' + title + '"? This cannot be undone.')) {
      event.preventDefault();
    }
  }}>
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="task_id" value={taskId} />
    <button className="danger-button" disabled={pending} aria-label={"Delete task: " + title}>
      {pending ? "Deleting…" : "Delete task"}
    </button>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
