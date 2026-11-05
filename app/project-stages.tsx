"use client";

import { useActionState, useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { stageAction, type StageState } from "@/lib/stages/actions";
import TaskDetailsDialog from "./task-details-dialog";
import styles from "./project-task-list.module.css";

type Stage = WorkspaceProject["stages"][number];

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
  return <form action={action} onSubmit={(event) => {
    if (!window.confirm('Delete stage "' + stage.name + '"? Its tasks will be kept without a stage.')) event.preventDefault();
  }}>
    <input type="hidden" name="operation" value="delete" />
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="stage_id" value={stage.id} />
    <button className="danger-button" disabled={pending}>{pending ? "Deleting…" : "Delete stage"}</button>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}

export default function ProjectStages({ project }: { project: WorkspaceProject }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const stage = project.stages.find((item) => item.id === editing);
  return <section className={"workspace-card " + styles.section} aria-labelledby="project-stages-heading">
    <div className="section-heading"><div><h2 id="project-stages-heading">Stages <span className="role-badge">{project.stages.length}</span></h2>
      <p>Organize project work into stages.</p></div>
      {project.canEdit && <button className="primary-button" onClick={() => setEditing("new")}>+ New stage</button>}
    </div>
    {project.stages.length === 0 ? <p>No stages yet.</p> : <ul className={styles.list}>
      {project.stages.map((item) => <li className={styles.task} key={item.id}>
        <div className={styles.heading}><h3>{item.name}</h3>
          {project.canEdit && <div className={styles.actions}>
            <button className="secondary-button" onClick={() => setEditing(item.id)}>Edit stage</button>
            <DeleteStage projectId={project.id} stage={item} />
          </div>}
        </div>
        {item.description && <p>{item.description}</p>}
        <p>Deadline: {item.deadline || "No deadline"} · {item.doneCount}/{item.taskCount} tasks completed</p>
      </li>)}
    </ul>}
    {(editing === "new" || stage) && project.canEdit && <TaskDetailsDialog title={stage ? "Edit stage" : "Create stage"} onClose={() => setEditing(null)}>
      <StageForm key={editing} projectId={project.id} stage={stage} close={() => setEditing(null)} />
    </TaskDetailsDialog>}
  </section>;
}
