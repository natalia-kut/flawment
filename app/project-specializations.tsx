"use client";

import { useActionState, type ReactNode } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { specializationAction } from "@/lib/specializations/actions";

function SpecializationForm({ operation, projectId, specializationId, children }: {
  operation: string; projectId: number; specializationId?: number; children: ReactNode;
}) {
  const [state, action, pending] = useActionState(specializationAction, {});
  return <form action={action} className="workspace-form specialization-form">
    <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="operation" value={operation} />
    {specializationId && <input type="hidden" name="specialization_id" value={specializationId} />}
    <fieldset disabled={pending}>{children}</fieldset>
    {pending && <p role="status">Saving…</p>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {state.success && <p role="status" className="form-success">{state.success}</p>}
  </form>;
}

export function MemberSpecialization({ project, member }: { project: WorkspaceProject; member: WorkspaceProject["members"][number] }) {
  return <SpecializationForm projectId={project.id} operation="assign">
    <input type="hidden" name="user_id" value={member.id} />
    <label>Specialization<select name="specialization_id" defaultValue={member.specializationId ?? ""} key={member.specializationId ?? "none"}>
      <option value="">No specialization</option>
      {project.specializations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label><button className="secondary-button">Save specialization</button>
  </SpecializationForm>;
}

export default function ProjectSpecializations({ project }: { project: WorkspaceProject }) {
  return <section className="workspace-card project-specializations"><h2>Specializations</h2><p>Skills and responsibilities specific to this project. These do not change permissions.</p>
    {project.specializations.length === 0 && <p>No specializations yet.</p>}
    <ul className="specialization-list">{project.specializations.map((item) => <li key={item.id}>
      <strong>{item.name}</strong>
      {project.canManageSpecializations && <details><summary>Edit</summary>
        <SpecializationForm operation="rename" projectId={project.id} specializationId={item.id}><label>Name<input name="name" required maxLength={80} defaultValue={item.name} /></label><button className="secondary-button">Rename</button></SpecializationForm>
        <SpecializationForm operation="delete" projectId={project.id} specializationId={item.id}><button className="danger-button">Delete specialization</button><small>Clears assignments; keeps members.</small></SpecializationForm>
      </details>}
    </li>)}</ul>
    {project.canManageSpecializations && <details><summary>Create specialization</summary><SpecializationForm operation="create" projectId={project.id}><label>Name<input name="name" placeholder="e.g. Backend" required maxLength={80} /></label><button className="primary-button">Create specialization</button></SpecializationForm></details>}
  </section>;
}
