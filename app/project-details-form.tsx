"use client";

import { useActionState, useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectAction } from "@/lib/projects/actions";
import { projectStatusLabels } from "@/lib/projects/labels";
import details from "@/components/ui/details-dialog.module.css";
import TaskDetailsDialog from "./task-details-dialog";

/**
 * Create or edit a project in the same in-place style as a task: the name is
 * the heading, then the description, then a grid of dates and status.
 */
export default function ProjectDetailsForm({ project, onClose, onSaved }: {
  /** Leave out to create a new project. */
  project?: WorkspaceProject;
  onClose: () => void;
  onSaved: (projectId?: number) => void;
}) {
  const creating = !project;
  const initial = {
    name: project?.name ?? "", description: project?.description ?? "",
    start_date: project?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: project?.end_date ?? "", status: (project?.status ?? "TO_DO") as string,
  };
  const [fields, setFields] = useState(initial);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => fields[key] !== initial[key]);
  const update = (key: keyof typeof initial, value: string) => setFields((current) => ({ ...current, [key]: value }));

  const [state, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof projectAction>>, data: FormData) => {
    const result = await projectAction(previous, data);
    if (result.success) onSaved(result.projectId);
    return result;
  }, {});
  const formId = "project-details-" + (project?.id ?? "new");
  const canSave = creating ? fields.name.trim() !== "" : dirty;

  return <TaskDetailsDialog title={project?.name ?? "New project"} onClose={onClose} heading={
    // A textarea so long names wrap like a heading; Enter must not add a line break.
    <textarea form={formId} name="name" className={details.titleInput} aria-label="Project name" placeholder="Project name"
      required maxLength={120} rows={1} value={fields.name}
      onChange={(e) => update("name", e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
  }>
    <form id={formId} action={action}>
      <input type="hidden" name="operation" value={creating ? "create" : "update"} />
      {project && <input type="hidden" name="project_id" value={project.id} />}
      <fieldset className={details.detailsFieldset} disabled={pending}>
        {creating && <p className={details.detailsContext}>Start with the basics. You can invite your team next.</p>}
        <textarea name="description" className={details.descriptionInput} aria-label="Description" maxLength={4000}
          placeholder="What will your team work on?" value={fields.description} onChange={(e) => update("description", e.target.value)} />
        <div className={details.detailsFacts}>
          <label><span>Start date</span>
            <input name="start_date" type="date" required value={fields.start_date} onChange={(e) => update("start_date", e.target.value)} />
          </label>
          <label><span>End date <em>· optional</em></span>
            <input name="end_date" type="date" value={fields.end_date} onChange={(e) => update("end_date", e.target.value)} />
          </label>
          <label className={details.detailsWide}><span>Status</span>
            <select name="status" value={fields.status} onChange={(e) => update("status", e.target.value)}>
              {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <div className="dialog-actions">
          {creating
            ? <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            : dirty && <button type="button" className="secondary-button" onClick={() => setFields(initial)}>Discard</button>}
          <button className="primary-button" disabled={!canSave || pending}>
            {pending ? "Saving…" : creating ? "Create project" : "Save changes"}
          </button>
        </div>
      </fieldset>
    </form>
  </TaskDetailsDialog>;
}
