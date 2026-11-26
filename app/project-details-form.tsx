"use client";

import { useActionState, type ReactNode } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectAction } from "@/lib/projects/actions";
import { projectStatusLabels } from "@/lib/projects/labels";
import { workspaceToday } from "@/lib/time-off/dates";
import details from "@/components/ui/details-dialog.module.css";
import TaskDetailsDialog from "./task-details-dialog";
import { submitInPlace } from "@/components/ui/submit-in-place";
import { useBaseFields } from "@/components/ui/use-base-fields";
import { useGuardedClose, useLeaveGuard } from "@/components/ui/unsaved";
import { OFFLINE, reach } from "@/components/ui/offline";

/**
 * Create or edit a project in the same in-place style as a task: the name is
 * the heading, then the description, then a grid of dates and status.
 */
export default function ProjectDetailsForm({ project, onClose, onSaved, deletion }: {
  /** Leave out to create a new project. */
  project?: WorkspaceProject;
  /**
   * Deleting the project: a form of its own (forms cannot nest), rendered after this one;
   * its button sits in this form's action row and submits it by id.
   */
  deletion?: { formId: string; form: ReactNode };
  onClose: () => void;
  onSaved: (projectId?: number) => void;
}) {
  const creating = !project;
  const initial = {
    name: project?.name ?? "", description: project?.description ?? "",
    // The Warsaw day: just after midnight the UTC day is still yesterday.
    start_date: project?.start_date ?? workspaceToday(),
    end_date: project?.end_date ?? "", status: (project?.status ?? "TO_DO") as string,
  };
  // As in the task dialog: sent with expected_* so a colleague's newer values are kept, and clashes refused.
  const { base, fields, dirty, clashed, keys, update, discard, clearClashed } = useBaseFields(initial, !creating);
  const notice = clashed.length ? `Someone else changed the ${clashed.map((key) => key.replace("_", " ")).join(", ")} meanwhile. Saving keeps your version.` : "";

  const [state, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof projectAction>>, data: FormData) => {
    const result = await reach(() => projectAction(previous, data), { error: OFFLINE });
    if (result.success) { clearClashed(); onSaved(result.projectId); }
    return result;
  }, {});
  const close = useGuardedClose(dirty, onClose);
  useLeaveGuard(dirty);
  const formId = "project-details-" + (project?.id ?? "new");
  const canSave = creating ? fields.name.trim() !== "" : dirty;

  return <TaskDetailsDialog title={project?.name ?? "New project"} onClose={close} heading={
    // A textarea so long names wrap like a heading; Enter must not add a line break.
    <textarea form={formId} name="name" className={details.titleInput} aria-label="Project name" placeholder="Project name"
      required maxLength={120} rows={1} value={fields.name}
      onChange={(e) => update("name", e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
  }>
    <form id={formId} action={action} onSubmit={submitInPlace(action)}>
      <input type="hidden" name="operation" value={creating ? "create" : "update"} />
      {project && <input type="hidden" name="project_id" value={project.id} />}
      {project && keys.map((key) => <input key={key} type="hidden" name={"expected_" + key} value={base[key]} />)}
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
        {notice && !state.error && <p className="form-error" role="status">{notice}</p>}
        <div className="dialog-actions">
          {deletion && <button type="submit" form={deletion.formId} className={`text-button danger ${details.detailsDelete}`}>Delete project</button>}
          {creating
            ? <button type="button" className="secondary-button" onClick={close}>Cancel</button>
            : dirty && <button type="button" className="secondary-button" onClick={discard}>Discard</button>}
          <button className="primary-button" disabled={!canSave || pending}>
            {pending ? "Saving…" : creating ? "Create project" : "Save changes"}
          </button>
        </div>
      </fieldset>
    </form>
    {deletion?.form}
  </TaskDetailsDialog>;
}
