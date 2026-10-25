"use client";

import { useActionState, useState } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectAction } from "@/lib/projects/actions";

function ProjectFields({ project }: { project?: WorkspaceProject }) {
  return <>
    <label>Project name<input name="name" required maxLength={120} defaultValue={project?.name} /></label>
    <label>Description<textarea name="description" maxLength={4000} defaultValue={project?.description ?? ""} /></label>
    <div className="form-row">
      <label>Start date<input name="start_date" type="date" required defaultValue={project?.start_date ?? new Date().toISOString().slice(0, 10)} /></label>
      <label>End date<input name="end_date" type="date" defaultValue={project?.end_date} /></label>
    </div>
    <label>Status<select name="status" defaultValue={project?.status ?? "TO_DO"}>
      {["TO_DO", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
    </select></label>
  </>;
}

function ChangeForm({ children, operation, projectId, onSubmit, className = "workspace-form" }: {
  children: React.ReactNode; operation: string; projectId?: number;
  onSubmit?: React.FormEventHandler<HTMLFormElement>; className?: string;
}) {
  const [state, action, pending] = useActionState(projectAction, {});
  return <form action={action} className={className} onSubmit={onSubmit}>
    <input type="hidden" name="operation" value={operation} />
    {projectId && <input type="hidden" name="project_id" value={projectId} />}
    <fieldset disabled={pending}>{children}</fieldset>
    {pending && <span role="status">Saving…</span>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && <p className="form-success" role="status">{state.success}</p>}
  </form>;
}

function RoleSelect({ elevated, value = "PARTICIPANT" }: { elevated: boolean; value?: string }) {
  return <label>Project role<select name="role" defaultValue={value}>
    {(elevated ? ["PARTICIPANT", "MANAGER", "ADMIN"] : ["PARTICIPANT"]).map((role) => <option key={role} value={role}>{role}</option>)}
  </select></label>;
}

export default function ProjectsView({ projects }: { projects: WorkspaceProject[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const project = projects.find((p) => p.id === selected);
  return <>
    <header className="page-header"><p className="eyebrow">WORKSPACE</p><h1>Projects</h1><p>Create a project, then bring your team together.</p></header>
    <div className="projects-workspace">
      <section className="workspace-card"><h2>Your projects <span className="role-badge">{projects.length}</span></h2>
        {projects.length === 0 && <p>You have no projects yet. Create your first one below.</p>}
        <div className="project-list">{projects.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id} className="project-list-item">
          <strong>{item.name}</strong><span>{item.status.replaceAll("_", " ")} · {item.role}</span>
        </button>)}</div>
        <details className="create-project" open={projects.length === 0}><summary>Create a project</summary>
          <ChangeForm operation="create"><ProjectFields /><button className="primary-button">Create project</button></ChangeForm>
        </details>
      </section>
      <section className="workspace-card" key={project?.id ?? "empty"}>
        {!project ? <><h2>Choose a project</h2><p>Select a project to view its details and members.</p></> : <>
          <div className="project-detail-heading"><h2>{project.name}</h2><span className="role-badge">{project.role}</span></div>
          <p>{project.description || "No description yet."}</p>
          <p>{project.start_date}{project.end_date ? ` → ${project.end_date}` : ""} · {project.status.replaceAll("_", " ")}</p>
          {project.canEdit && <details><summary>Edit project</summary><ChangeForm operation="update" projectId={project.id}>
            <ProjectFields project={project} /><button className="primary-button">Save project</button>
          </ChangeForm></details>}
          <h3>Members ({project.members.length})</h3>
          <ul className="member-list">{project.members.map((member) => <li key={member.id}>
            <div><strong>{member.first_name} {member.last_name}</strong><small>{member.email}</small><span className="role-badge">{member.role}{member.id === project.owner_id ? " · Owner" : ""}</span></div>
            {project.canManage && member.id !== project.owner_id && <div className="member-controls">
              {project.canAssignRoles && <ChangeForm operation="role" projectId={project.id} className="compact-form">
                <input type="hidden" name="user_id" value={member.id} /><RoleSelect elevated value={member.role} /><button className="secondary-button">Save role</button>
              </ChangeForm>}
              {(project.canAssignRoles || member.role === "PARTICIPANT") && <ChangeForm operation="remove" projectId={project.id} className="compact-form" onSubmit={(event) => { if (!window.confirm(`Remove ${member.first_name} from this project?`)) event.preventDefault(); }}>
                <input type="hidden" name="user_id" value={member.id} /><button className="danger-button">Remove</button>
              </ChangeForm>}
            </div>}
          </li>)}</ul>
          {project.canManage && <section className="add-member"><h3>Add a member</h3>
            {project.eligible.length === 0 ? <p>All active users are already members.</p> : <ChangeForm key={project.eligible.map((u) => u.id).join(",")} operation="add" projectId={project.id}>
              <label>Available users<select name="user_id" required defaultValue=""><option value="" disabled>Select a user</option>{project.eligible.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email})</option>)}</select></label>
              <RoleSelect elevated={project.canAssignRoles} /><button className="primary-button">Add to project</button>
            </ChangeForm>}
          </section>}
          {project.canDelete && <div className="delete-project"><h3>Delete project</h3><p>This deletes the project, its memberships, and its tasks.</p>
            <ChangeForm operation="delete" projectId={project.id} onSubmit={(event) => { if (!window.confirm(`Permanently delete “${project.name}” and all its tasks?`)) event.preventDefault(); }}>
              <button className="danger-button">Delete project</button>
            </ChangeForm>
          </div>}
        </>}
      </section>
    </div>
  </>;
}
