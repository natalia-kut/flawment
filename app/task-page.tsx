"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition, type ReactNode } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import type { TaskDetails } from "@/lib/tasks/details";
import { changeTaskStatusAction, patchTaskAction } from "@/lib/tasks/actions";
import { formatTaskDeadline, taskPriorityLabels, taskStatusLabels } from "@/lib/tasks/labels";
import { isTaskOverdue } from "@/lib/tasks/board";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/tasks/limits";
import { normalizeNewlines, toggleTask } from "@/lib/rich-text/markdown";
import RichText from "@/components/rich-text/rich-text";
import { EditableRichText, LazyRichTextEditor } from "@/components/rich-text/rich-text-field";
import PageHeader from "@/components/page-header";
import { celebrate } from "@/components/ui/confetti";
import AvailabilityBadge from "./availability-badge";
import DeleteTaskForm from "./delete-task-form";
import TaskComments, { type CommentViewer } from "./task-comments";
import UserAvatar from "./user-avatar";
import styles from "./task-page.module.css";

type Task = WorkspaceProject["tasks"][number];
type Values = {
  title: string; description: string; status: string; priority: string;
  assigned_to: string; deadline: string; stage_id: string;
};

const COPIED_MS = 2000;
const SAVED_MS = 3000;
const DEADLINE_DELAY_MS = 900;

function Breadcrumbs({ project, current }: { project?: WorkspaceProject; current: string }) {
  return <nav className="project-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li><Link href="/?view=tasks">Tasks</Link></li>
      {project && <li><span className="breadcrumb-separator" aria-hidden="true">/</span><Link href={"/?project=" + project.id}>{project.name}</Link></li>}
      <li><span className="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">{current}</span></li>
    </ol>
  </nav>;
}

export function TaskUnavailable() {
  return <>
    <Breadcrumbs current="Unavailable task" />
    <section className="project-empty-state">
      <h1>Task unavailable</h1>
      <p>This task was deleted or you no longer have access.</p>
      <Link href="/?view=tasks" className="secondary-button">Back to tasks</Link>
    </section>
  </>;
}

/** A fact in the side panel: a field when it can be changed, otherwise plain text. */
function Fact({ label, note, editable, children }: { label: string; note?: ReactNode; editable: boolean; children: ReactNode }) {
  const heading = <span className={styles.label}>{label}{note}</span>;
  return editable
    ? <label className={styles.fact}>{heading}{children}</label>
    : <div className={styles.fact}>{heading}<span className={styles.value}>{children}</span></div>;
}

/**
 * Picking a day saves it. Typing a date passes through half-written years and an empty
 * value on the way, so typing is saved after a pause, and clearing once you leave the field.
 */
function DeadlineInput({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft !== null && draft !== value) onSave(draft);
    setDraft(null);
  }
  const ready = draft !== null && draft !== value && draft >= "2000";
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { onSave(draft!); setDraft(null); }, DEADLINE_DELAY_MS);
    return () => clearTimeout(timer);
  // Only a change of the draft restarts the wait, not a re-render of the page around it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, ready]);
  return <input type="date" value={draft ?? value} max="9999-12-31"
    onChange={(event) => setDraft(event.target.value)} onBlur={commit} />;
}

/** One task with everything about it: its text, its facts (each saved as you change it) and the discussion. */
export default function TaskPage({ project, task, details, viewer, today }: {
  project: WorkspaceProject; task: Task; details: TaskDetails; viewer: CommentViewer; today: string;
}) {
  const router = useRouter();
  const saved: Values = {
    title: task.title, description: normalizeNewlines(task.description ?? ""), status: task.status, priority: task.priority,
    assigned_to: task.assignedTo?.toString() ?? "", deadline: task.deadline, stage_id: task.stageId?.toString() ?? "",
  };
  // A change shows at once, and falls back to the saved value by itself when it is refused.
  const [values, showChange] = useOptimistic(saved, (current, change: Partial<Values>) => ({ ...current, ...change }));
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  // Not null while the description is being edited.
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), SAVED_MS);
    return () => clearTimeout(timer);
  }, [justSaved]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  function run(change: Partial<Values>, action: typeof patchTaskAction, data: FormData, onSuccess?: () => void) {
    data.set("project_id", String(project.id));
    data.set("task_id", String(task.id));
    setError(""); setJustSaved(false);
    startSaving(async () => {
      showChange(change);
      try {
        const result = await action(data);
        if (result.error) { setError(result.error); router.refresh(); }
        else { setJustSaved(true); onSuccess?.(); }
      } catch {
        setError("Could not save the change. Please try again.");
      }
    });
  }
  function save(key: Exclude<keyof Values, "status">, value: string, onSuccess?: () => void) {
    const data = new FormData();
    data.set(key, value);
    run({ [key]: value }, patchTaskAction, data, onSuccess);
  }
  // The status has its own action: whoever the task is assigned to may move it without editing the rest.
  function saveStatus(status: string, origin: { x: number; y: number }) {
    const data = new FormData();
    data.set("status", status);
    data.set("expected_status", values.status);
    run({ status }, changeTaskStatusAction, data, () => { if (status === "COMPLETED") celebrate("small", origin); });
  }
  function commitTitle() {
    const title = titleDraft?.trim() ?? "";
    setTitleDraft(null);
    if (title && title !== values.title) save("title", title);
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?task=${task.id}`);
      setCopied(true);
    } catch {
      setError("Could not copy the link. Copy it from the address bar instead.");
    }
  }

  const late = isTaskOverdue({ deadline: values.deadline, status: values.status }, today);
  const assignee = project.members.find((member) => String(member.id) === values.assigned_to);
  const stage = project.stages.find((item) => String(item.id) === values.stage_id);
  const descriptionDirty = descriptionDraft !== null && descriptionDraft.trim() !== values.description;
  const descriptionTooLong = (descriptionDraft?.length ?? 0) > MAX_DESCRIPTION_LENGTH;
  function saveDescription() {
    // The draft stays until it is saved, so a failed save loses nothing.
    if (descriptionDirty && !descriptionTooLong && !saving) save("description", descriptionDraft.trim(), () => setDescriptionDraft(null));
  }
  function toggleChecklist(index: number) {
    const description = toggleTask(values.description, index);
    if (description === null) setDescriptionDraft(values.description);
    else save("description", description);
  }

  return <div className={styles.page}>
    <PageHeader
      title={task.canEdit
        ? <textarea className={styles.title} aria-label="Task title" rows={1} maxLength={150}
          value={titleDraft ?? values.title}
          onChange={(event) => setTitleDraft(event.target.value.replace(/\n/g, " "))}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
            else if (event.key === "Escape") setTitleDraft(null);
          }} />
        : values.title}
      breadcrumbs={<Breadcrumbs project={project} current={"#" + task.id} />}
      actions={<button type="button" className="secondary-button" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button>} />

    <div className={styles.layout}>
      <aside className={"workspace-card " + styles.facts} aria-label="Task details">
        {/* A fixed line, so nothing moves when "Saved" comes and goes. */}
        <div className={styles.factsHeading}>
          <h2>Details</h2>
          <span className={styles.saved} role="status">{saving ? "Saving…" : justSaved ? "Saved" : ""}</span>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        <Fact label="Status" editable={task.canChangeStatus}>
          {task.canChangeStatus
            ? <select className={styles.status} data-status={values.status} value={values.status} onChange={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              saveStatus(event.target.value, { x: box.left + box.width / 2, y: box.top });
            }}>
              {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            : <span className={styles.status} data-status={values.status}>{taskStatusLabels[values.status]}</span>}
        </Fact>

        <Fact label="Priority" editable={task.canEdit} note={<span className={styles.priority} data-priority={values.priority} aria-hidden="true" />}>
          {task.canEdit
            ? <select value={values.priority} onChange={(event) => save("priority", event.target.value)}>
              {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            : taskPriorityLabels[values.priority]}
        </Fact>

        <div>
          <Fact label="Assigned to" editable={task.canEdit}>
            <span className={styles.person}>
              {assignee && <UserAvatar id={assignee.id} firstName={assignee.first_name} lastName={assignee.last_name} photoVersion={assignee.photoVersion} size={34} />}
              {task.canEdit
                ? <select value={values.assigned_to} onChange={(event) => save("assigned_to", event.target.value)}>
                  <option value="">Unassigned</option>
                  {project.members.filter((member) => project.canManageTasks || member.id === project.viewerId || String(member.id) === saved.assigned_to)
                    .map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}
                </select>
                : task.assigneeName}
            </span>
          </Fact>
          {assignee?.availability && <div className={styles.away}><AvailabilityBadge availability={assignee.availability} /></div>}
        </div>

        <Fact label="Deadline" editable={task.canEdit} note={late && <em className={styles.late}> · overdue</em>}>
          {task.canEdit
            ? <DeadlineInput value={values.deadline} onSave={(value) => save("deadline", value)} />
            : formatTaskDeadline(values.deadline)}
        </Fact>

        <Fact label="Stage" editable={task.canEdit}>
          {task.canEdit
            ? <select value={values.stage_id} onChange={(event) => save("stage_id", event.target.value)}>
              <option value="">No stage</option>
              {project.stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            : stage?.name ?? "No stage"}
        </Fact>

        <div className={styles.history}>
          <p>Added by {`${details.creator.firstName} ${details.creator.lastName}`.trim()} on {details.createdOn}</p>
          <p>Last changed {details.updatedAt}</p>
          {task.canEdit && <DeleteTaskForm label="Delete task" projectId={project.id} taskId={task.id} title={task.title}
            onDeleted={() => router.replace("/?project=" + project.id)} />}
        </div>
      </aside>

      <div className={styles.main}>
        <section className="workspace-card" aria-labelledby="task-description-heading">
          <h2 id="task-description-heading">Description</h2>
          {descriptionDraft !== null
            ? <div>
              <LazyRichTextEditor initial={values.description} label="Description" placeholder="Add a description…" autoFocus
                onChange={setDescriptionDraft} onSubmit={saveDescription} />
              <div className={styles.formActions}>
                <span className={styles.hint} data-over={descriptionTooLong || undefined}>
                  {descriptionDraft.length > MAX_DESCRIPTION_LENGTH * .9
                    ? `${descriptionDraft.length} of ${MAX_DESCRIPTION_LENGTH} characters, formatting included`
                    : "Ctrl + Enter to save"}
                </span>
                <button type="button" className="secondary-button" onClick={() => setDescriptionDraft(null)}>Cancel</button>
                <button type="button" className="primary-button" disabled={saving || !descriptionDirty || descriptionTooLong} onClick={saveDescription}>{saving ? "Saving…" : "Save description"}</button>
              </div>
            </div>
            : task.canEdit
              ? <EditableRichText text={values.description} label="Description" placeholder="Add a description…"
                onEdit={() => setDescriptionDraft(values.description)} onToggleTask={toggleChecklist} />
              : values.description ? <RichText text={values.description} /> : <p className={styles.empty}>No description yet.</p>}
        </section>
        <TaskComments taskId={task.id} comments={details.comments} canModerate={project.canManageTasks} viewer={viewer} />
      </div>
    </div>
  </div>;
}
