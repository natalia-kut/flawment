"use client";

import { useActionState, useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { createTaskAction, updateTaskAction, type TaskState } from "@/lib/tasks/actions";

export default function CreateTaskForm({ project, task, onCancel, onSuccess }: {
  project: WorkspaceProject; task?: WorkspaceProject["tasks"][number]; onCancel: () => void; onSuccess: () => void;
}) {
  const [fields, setFields] = useState({
    stage_id: task?.stageId?.toString() ?? "",
    title: task?.title ?? "", description: task?.description ?? "",
    priority: task?.priority ?? "MEDIUM", deadline: task?.deadline ?? "",
    assigned_to: task?.assignedTo?.toString() ?? "", status: task?.status ?? "TO_DO",
  });
  function update(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  const [state, action, pending] = useActionState(async (previous: TaskState, data: FormData) => {
    const result = await (task ? updateTaskAction : createTaskAction)(previous, data);
    if (result.success) onSuccess();
    return result;
  }, {});
  return <form action={action} className="workspace-form">
    <input type="hidden" name="project_id" value={project.id} />
    {task && <input type="hidden" name="task_id" value={task.id} />}
    <fieldset disabled={pending}>
      <label>Title<input name="title" required maxLength={150} value={fields.title} onChange={(e) => update("title", e.target.value)} /></label>
      <label>Description<textarea name="description" maxLength={5000} value={fields.description} onChange={(e) => update("description", e.target.value)} /></label>
      {task && <label>Status<select name="status" value={fields.status} onChange={(e) => update("status", e.target.value)}>
        {["TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
      </select></label>}
      <label>Stage<select name="stage_id" value={fields.stage_id} onChange={(e) => update("stage_id", e.target.value)}>
        <option value="">No stage</option>
        {project.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
      </select></label>
      <label>Priority<select name="priority" value={fields.priority} onChange={(e) => update("priority", e.target.value)}>
        {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
      </select></label>
      <label>Deadline <span className="optional-label">Optional</span><input name="deadline" type="date" value={fields.deadline} onChange={(e) => update("deadline", e.target.value)} /></label>
      <label>Assigned to<select name="assigned_to" value={fields.assigned_to} onChange={(e) => update("assigned_to", e.target.value)}>
        <option value="">Unassigned</option>
        {project.members.map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}
      </select></label>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" disabled={pending}>{pending ? "Saving…" : task ? "Save changes" : "Create task"}</button>
      </div>
    </fieldset>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
