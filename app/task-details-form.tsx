"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { createTaskAction, updateTaskAction, type TaskState } from "@/lib/tasks/actions";
import { taskPriorityLabels, taskStatusLabels } from "@/lib/tasks/labels";
import TaskDetailsDialog from "./task-details-dialog";
import { celebrate } from "@/components/ui/confetti";
import styles from "./tasks-board.module.css";
import details from "@/components/ui/details-dialog.module.css";

type Task = WorkspaceProject["tasks"][number];

/**
 * The one task dialog, for both a new task and an existing one: the title,
 * description and every fact are fields, edited in place. Used by the Tasks
 * board and by the project page, so both look and behave the same.
 */
export default function TaskDetailsForm({ project: initialProject, projectChoices, task, initialStatus = "TO_DO", overdue = false, showOpenProject = true, onClose, onSaved }: {
  project: WorkspaceProject;
  /** For a new task: the status it starts in, e.g. the board column it was created from. */
  initialStatus?: string;
  /** For a new task started outside a project (the Tasks board): the projects it may go into. */
  projectChoices?: WorkspaceProject[];
  /** Leave out to create a new task. */
  task?: Task;
  overdue?: boolean;
  showOpenProject?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const creating = !task;
  const [projectId, setProjectId] = useState(initialProject.id);
  const project = projectChoices?.find((choice) => choice.id === projectId) ?? initialProject;
  const choosingProject = creating && !!projectChoices && projectChoices.length > 1;
  const initial = {
    title: task?.title ?? "", description: task?.description ?? "", status: (task?.status ?? initialStatus) as string,
    priority: (task?.priority ?? "MEDIUM") as string, assigned_to: task?.assignedTo?.toString() ?? "",
    deadline: task?.deadline ?? "", stage_id: task?.stageId?.toString() ?? "",
  };
  const [fields, setFields] = useState(initial);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => fields[key] !== initial[key]);
  const update = (key: keyof typeof initial, value: string) => setFields((current) => ({ ...current, [key]: value }));

  const [state, action, pending] = useActionState(async (previous: TaskState, data: FormData) => {
    const result = await (creating ? createTaskAction : updateTaskAction)(previous, data);
    if (result.success && !creating && data.get("status") === "COMPLETED" && initial.status !== "COMPLETED") {
      // Burst from the button that saved it (the focused submitter), or the middle of the screen.
      const box = document.activeElement instanceof HTMLElement ? document.activeElement.getBoundingClientRect() : null;
      celebrate("small", box && box.width ? { x: box.left + box.width / 2, y: box.top } : undefined);
    }
    if (result.success) onSaved();
    return result;
  }, {});
  const formId = "task-details-" + (task?.id ?? "new");
  const assignee = project.members.find((member) => String(member.id) === fields.assigned_to);
  const canSave = creating ? fields.title.trim() !== "" : dirty;

  return <TaskDetailsDialog title={task?.title ?? "New task"} onClose={onClose} focusFirstField={creating} heading={
    // A textarea so long titles wrap like a heading; Enter must not add a line break.
    <textarea form={formId} name="title" className={details.titleInput} aria-label="Task title" placeholder="Task title"
      required maxLength={150} rows={1} value={fields.title}
      onChange={(e) => update("title", e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
  }>
    <form id={formId} action={action}>
      <input type="hidden" name="project_id" value={project.id} />
      {task && <input type="hidden" name="task_id" value={task.id} />}
      <fieldset className={details.detailsFieldset} disabled={pending}>
        {choosingProject
          ? <label className={details.detailsWide}><span>Project</span>
            {/* People and stages belong to a project, so switching clears them. */}
            <select value={project.id} onChange={(e) => {
              setProjectId(Number(e.target.value));
              setFields((current) => ({ ...current, assigned_to: "", stage_id: "" }));
            }}>
              {projectChoices!.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
            </select>
          </label>
          : <p className={details.detailsContext}>{project.name}</p>}
        <textarea name="description" className={details.descriptionInput} aria-label="Description" maxLength={5000}
          placeholder="Add a description…" value={fields.description} onChange={(e) => update("description", e.target.value)} />
        <div className={details.detailsFacts}>
          {/* A new task starts in the column it was created from ("To do" from elsewhere), and can be changed here. */}
          <label><span>Status</span>
            <select name="status" value={fields.status} onChange={(e) => update("status", e.target.value)}>
              {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label><span>Priority</span>
            <select name="priority" value={fields.priority} onChange={(e) => update("priority", e.target.value)}>
              {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label><span>Assigned to</span>
            <select name="assigned_to" value={fields.assigned_to} onChange={(e) => update("assigned_to", e.target.value)}>
              <option value="">Unassigned</option>
              {project.members.filter((member) => project.canManageTasks || member.id === project.viewerId || String(member.id) === initial.assigned_to)
                .map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}{member.availability ? ` · ${member.availability.state === "away" ? "out of office" : "away soon"}` : ""}</option>)}
            </select>
          </label>
          <label><span>Deadline{overdue && !dirty && <em className={styles.lateText}> · overdue</em>}</span>
            <input name="deadline" type="date" value={fields.deadline} onChange={(e) => update("deadline", e.target.value)} />
          </label>
          <label className={creating ? undefined : details.detailsWide}><span>Stage</span>
            <select name="stage_id" value={fields.stage_id} onChange={(e) => update("stage_id", e.target.value)}>
              <option value="">No stage</option>
              {project.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
          </label>
        </div>
        {assignee?.availability && <p className="availability-note" role="status">
          Heads up: {assignee.first_name} {assignee.availability.state === "away" ? "is" : "will be"} {assignee.availability.label.charAt(0).toLowerCase() + assignee.availability.label.slice(1)}.
        </p>}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <div className="dialog-actions">
          {showOpenProject && <Link className="secondary-button" href={"/?project=" + project.id}>Open project</Link>}
          {creating
            ? <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            : dirty && <button type="button" className="secondary-button" onClick={() => setFields(initial)}>Discard</button>}
          <button className="primary-button" disabled={!canSave || pending}>
            {pending ? "Saving…" : creating ? "Create task" : "Save changes"}
          </button>
        </div>
      </fieldset>
    </form>
  </TaskDetailsDialog>;
}
