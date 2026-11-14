"use client";

import { useActionState, useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { stageAction, type StageState } from "@/lib/stages/actions";
import TaskDetailsDialog from "./task-details-dialog";
import styles from "./project-stages.module.css";
import { useConfirmSubmit } from "@/components/ui/confirm";
import { BinIcon, PencilIcon } from "@/components/ui/icons";

type Stage = WorkspaceProject["stages"][number];

const dueDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function StageForm({ projectId, stage, close }: { projectId: number; stage?: Stage; close: () => void }) {
  const [fields, setFields] = useState({
    name: stage?.name ?? "", description: stage?.description ?? "", deadline: stage?.deadline ?? "",
  });
  const [state, action, pending] = useActionState(async (previous: StageState, data: FormData) => {
    const result = await stageAction(previous, data);
    if (result.success) close();
    return result;
  }, {});
  return <form action={action} className="workspace-form">
    <input type="hidden" name="operation" value={stage ? "update" : "create"} />
    <input type="hidden" name="project_id" value={projectId} />
    {stage && <input type="hidden" name="stage_id" value={stage.id} />}
    <fieldset disabled={pending}>
      <label>Name<input name="name" required maxLength={120} value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} /></label>
      <label>Description<textarea name="description" maxLength={4000} value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} /></label>
      <label>Deadline (optional)<input name="deadline" type="date" value={fields.deadline} onChange={(e) => setFields({ ...fields, deadline: e.target.value })} /></label>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button>
        <button className="primary-button">{pending ? "Saving…" : stage ? "Save changes" : "Create stage"}</button></div>
    </fieldset>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}

function DeleteStage({ projectId, stage }: { projectId: number; stage: Stage }) {
  const [state, action, pending] = useActionState(stageAction, {});
  const confirmSubmit = useConfirmSubmit();
  return <form action={action} onSubmit={confirmSubmit({ title: `Delete the “${stage.name}” stage?`, message: "Its tasks are kept, just without a stage.", confirm: "Delete stage" })}>
    <input type="hidden" name="operation" value="delete" />
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="stage_id" value={stage.id} />
    <button className="icon-button" disabled={pending} aria-label={`Delete stage: ${stage.name}`} title="Delete stage">
      <BinIcon />
    </button>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}

export default function ProjectStages({ project }: { project: WorkspaceProject }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const stage = project.stages.find((item) => item.id === editing);
  return <section className={"workspace-card " + styles.section} aria-labelledby="project-stages-heading">
    <div className="section-heading"><div><h2 id="project-stages-heading">Stages <span className="role-badge">{project.stages.length}</span></h2></div>
      {project.canEdit && <button className="primary-button" onClick={() => setEditing("new")}>+ New stage</button>}
    </div>
    {project.stages.length === 0 ? <p>No stages yet. Group the project&apos;s work into stages, such as milestones or phases.</p> : <ul className={styles.list}>
      {project.stages.map((item) => <li className={styles.stage} key={item.id}>
        <div className={styles.info}>
          <h3>{item.name}</h3>
          {item.description && <p className={styles.description}>{item.description}</p>}
          <p className={styles.meta}>
            <span>{item.deadline ? "Due " + dueDate.format(new Date(item.deadline + "T00:00:00Z")) : "No deadline"}</span>
            <span>{item.doneCount}/{item.taskCount} tasks done</span>
            {item.taskCount > 0 && <span className={styles.progress} aria-hidden="true"><span style={{ width: `${(item.doneCount / item.taskCount) * 100}%` }} /></span>}
          </p>
        </div>
        {project.canEdit && <div className={styles.actions}>
          <button type="button" className="icon-button edit" onClick={() => setEditing(item.id)} aria-label={`Edit stage: ${item.name}`} title="Edit stage">
            <PencilIcon />
          </button>
          <DeleteStage projectId={project.id} stage={item} />
        </div>}
      </li>)}
    </ul>}
    {(editing === "new" || stage) && project.canEdit && <TaskDetailsDialog title={stage ? "Edit stage" : "Create stage"} onClose={() => setEditing(null)}>
      <StageForm key={editing} projectId={project.id} stage={stage} close={() => setEditing(null)} />
    </TaskDetailsDialog>}
  </section>;
}
