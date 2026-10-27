"use client";

import Link from "next/link";
import CreateTaskForm from "./create-task-form";
import ProjectTaskList from "./project-task-list";
import ProjectStages from "./project-stages";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode, type FormEventHandler } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectAction } from "@/lib/projects/actions";

function ProjectFields({ project }: { project?: WorkspaceProject }) {
  return <>
    <label>Project name<input name="name" required maxLength={120} defaultValue={project?.name} placeholder="Give your project a name" /></label>
    <label>Description<textarea name="description" maxLength={4000} defaultValue={project?.description ?? ""} placeholder="What will your team work on?" /></label>
    <div className="form-row">
      <label>Start date<input name="start_date" type="date" required defaultValue={project?.start_date ?? new Date().toISOString().slice(0, 10)} /></label>
      <label>End date <span className="optional-label">Optional</span><input name="end_date" type="date" defaultValue={project?.end_date} /></label>
    </div>
    <label>Status<select name="status" defaultValue={project?.status ?? "TO_DO"}>
      {["TO_DO", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
    </select></label>
  </>;
}

function ChangeForm({ children, operation, projectId, onSubmit, onSuccess, className = "workspace-form" }: {
  children: ReactNode; operation: string; projectId?: number;
  onSubmit?: FormEventHandler<HTMLFormElement>; onSuccess?: (projectId?: number) => void; className?: string;
}) {
  const [state, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof projectAction>>, data: FormData) => {
    const result = await projectAction(previous, data);
    if (result.success) onSuccess?.(result.projectId);
    return result;
  }, {});
  return <form action={action} className={className} onSubmit={onSubmit}>
    <input type="hidden" name="operation" value={operation} />
    {projectId && <input type="hidden" name="project_id" value={projectId} />}
    <fieldset disabled={pending}>{children}</fieldset>
    {pending && <span role="status">Saving…</span>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.success && !onSuccess && <p className="form-success" role="status">{state.success}</p>}
  </form>;
}

function RoleSelect({ elevated, value = "PARTICIPANT" }: { elevated: boolean; value?: string }) {
  return <label>Project role<select name="role" defaultValue={value}>
    {(elevated ? ["PARTICIPANT", "MANAGER", "ADMIN"] : ["PARTICIPANT"]).map((role) => <option key={role} value={role}>{role}</option>)}
  </select></label>;
}

function ProjectDialog({ title, description, onClose, children }: {
  title: string; description: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return <dialog ref={ref} className="project-dialog" aria-labelledby="project-dialog-title" aria-describedby="project-dialog-description"
    onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="project-dialog-content">
      <div className="project-dialog-heading"><h2 id="project-dialog-title">{title}</h2><button type="button" className="dialog-close" onClick={onClose} aria-label="Close dialog">×</button></div>
      <p id="project-dialog-description">{description}</p>
      {children}
    </div>
  </dialog>;
}

export default function ProjectsView({ projects }: { projects: WorkspaceProject[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const selected = search.get("project");
  const project = projects.find((p) => String(p.id) === selected);
  const [modal, setModal] = useState<"create" | "edit" | "add" | "task" | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const editingTask = project?.tasks.find((task) => task.id === editingTaskId);
  const close = () => { setModal(null); setEditingTaskId(null); };
  return <div className="projects-workspace">
    {selected && <nav className="project-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li><Link href="/">Projects</Link></li>
        <li><span className="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">{project?.name ?? "Unavailable project"}</span></li>
      </ol>
    </nav>}

    {!selected ? <>
      <header className="page-header projects-page-heading">
        <div><h1>Projects</h1><p>A place for every idea. Choose a project to pick up where you left off.</p></div>
        <button className="primary-button" onClick={() => setModal("create")}><span aria-hidden="true">+</span> New project</button>
      </header>
      {projects.length === 0 ? <section className="project-empty-state"><span aria-hidden="true">↗</span><h2>Make room for your next idea</h2><p>Create a project and bring your team together.</p><button className="primary-button" onClick={() => setModal("create")}>Create your first project</button></section> :
        <div className="project-browser-grid">{projects.map((item) => <Link href={`/?project=${item.id}`} key={item.id} className="project-browser-card">
          <div className="project-card-topline"><span className="role-badge">{item.status.replaceAll("_", " ")}</span><span aria-hidden="true">↗</span></div>
          <h2>{item.name}</h2><p>{item.description || "Your next chapter starts here."}</p>
          <div className="project-card-meta"><span>{item.members.length} {item.members.length === 1 ? "member" : "members"}</span><span>{item.role?.replaceAll("_", " ")}</span></div>
        </Link>)}</div>}
    </> : !project ? <section className="project-empty-state"><h1>Project unavailable</h1><p>This project was deleted or you no longer have access.</p><Link href="/" className="secondary-button">Back to projects</Link></section> : <>
      <header className="page-header projects-page-heading"><div><h1>{project.name}</h1><p>{project.description || "Add a description to tell your team what this project is about."}</p></div>
        {project.canEdit && <button className="secondary-button" onClick={() => setModal("edit")}>Edit project</button>}
      </header>
      <ProjectStages key={"stages-" + project.id} project={project} />
      <ProjectTaskList key={project.id} project={project}
        onCreate={() => { setEditingTaskId(null); setModal("task"); }}
        onEdit={(id) => { setModal(null); setEditingTaskId(id); }} />
      <div className="project-detail-layout">
        <section className="workspace-card project-team" key={project.id}>
          <div className="section-heading"><div><h2>People <span className="role-badge">{project.members.length}</span></h2><p>The team making it happen.</p></div>{project.canManage && <button className="primary-button" onClick={() => setModal("add")}>Add member</button>}</div>
          {project.members.length === 0 && <p>No team members yet.</p>}
          <ul className="member-list">{project.members.map((member) => <li key={member.id}>
            <div className="member-identity"><span className="member-avatar" aria-hidden="true">{member.first_name.slice(0, 1)}{member.last_name.slice(0, 1)}</span><div><strong>{member.first_name} {member.last_name}</strong><small>{member.email}</small><span className="role-badge">{member.role}{member.id === project.owner_id ? " · Owner" : ""}</span></div></div>
            {project.canManage && member.id !== project.owner_id && (project.canAssignRoles || member.role === "PARTICIPANT") && <details className="member-settings"><summary>Manage</summary><div className="member-controls">
              {project.canAssignRoles && <ChangeForm operation="role" projectId={project.id} className="compact-form"><input type="hidden" name="user_id" value={member.id} /><RoleSelect elevated value={member.role} /><button className="secondary-button">Save role</button></ChangeForm>}
              <ChangeForm operation="remove" projectId={project.id} className="compact-form" onSubmit={(event) => { if (!window.confirm(`Remove ${member.first_name} from this project?`)) event.preventDefault(); }}>
                <input type="hidden" name="user_id" value={member.id} /><button className="danger-button">Remove member</button>
              </ChangeForm>
            </div></details>}
          </li>)}</ul>
        </section>
        <aside className="project-overview-sidebar">
          <section className="workspace-card project-facts"><h2>At a glance</h2><dl><div><dt>Status</dt><dd>{project.status.replaceAll("_", " ")}</dd></div><div><dt>Start date</dt><dd>{project.start_date}</dd></div><div><dt>End date</dt><dd>{project.end_date || "No deadline"}</dd></div><div><dt>Your role</dt><dd>{project.role?.replaceAll("_", " ")}</dd></div></dl></section>
          {project.canDelete && <details className="project-danger-zone"><summary>Project settings</summary><p>Deleting this project also deletes its tasks and memberships.</p><ChangeForm operation="delete" projectId={project.id} onSuccess={() => router.push("/")} onSubmit={(event) => { if (!window.confirm(`Permanently delete “${project.name}” and all its tasks?`)) event.preventDefault(); }}><button className="danger-button">Delete project</button></ChangeForm></details>}
        </aside>
      </div>
    </>}

    {editingTask && project?.canManageTasks && <ProjectDialog title="Edit task" description="Update the task details and track its progress." onClose={close}>
      <CreateTaskForm key={editingTask.id} project={project} task={editingTask} onCancel={close} onSuccess={close} />
    </ProjectDialog>}
    {modal === "task" && project?.canManageTasks && <ProjectDialog title="Create a task" description="Plan the next piece of work for your project." onClose={close}>
      <CreateTaskForm project={project} onCancel={close} onSuccess={close} />
    </ProjectDialog>}
    {modal === "create" && <ProjectDialog title="Create a project" description="Start with the basics. You can invite your team next." onClose={close}>
      <ChangeForm operation="create" onSuccess={(id) => { close(); router.push(`/?project=${id}`); }}><ProjectFields /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button">Create project</button></div></ChangeForm>
    </ProjectDialog>}
    {modal === "edit" && project && <ProjectDialog title="Edit project" description="Keep your team aligned with the latest details." onClose={close}>
      <ChangeForm operation="update" projectId={project.id} onSuccess={close}><ProjectFields project={project} /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button">Save changes</button></div></ChangeForm>
    </ProjectDialog>}
    {modal === "add" && project && <ProjectDialog title="Bring someone on board" description={`Add a registered user to ${project.name}.`} onClose={close}>
      {project.eligible.length === 0 ? <p>There are no other available users to add.</p> : <ChangeForm operation="add" projectId={project.id} onSuccess={close}>
        <label>Available users<select name="user_id" required defaultValue=""><option value="" disabled>Select a user</option>{project.eligible.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email})</option>)}</select></label>
        <RoleSelect elevated={project.canAssignRoles} /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button">Add member</button></div>
      </ChangeForm>}
    </ProjectDialog>}
  </div>;
}
