"use client";

import Link from "next/link";
import TaskDetailsForm from "./task-details-form";
import ProjectDetailsForm from "./project-details-form";
import { isTaskOverdue } from "@/lib/tasks/board";
import ProjectTaskList from "./project-task-list";
import ProjectStages from "./project-stages";
import ProjectBrowser from "./project-browser";
import UserAvatar from "./user-avatar";
import AvailabilityBadge from "./availability-badge";
import { StatusText } from "./status-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode, type FormEventHandler } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectAction } from "@/lib/projects/actions";
import { projectRoleLabels } from "@/lib/projects/labels";
import PageHeader from "@/components/page-header";

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

/** `saveOnChange` saves as soon as a role is picked (changing a member's role); otherwise it is part of a form. */
function RoleSelect({ elevated, value = "PARTICIPANT", saveOnChange = false }: { elevated: boolean; value?: string; saveOnChange?: boolean }) {
  return <label>{saveOnChange ? "Role" : "Project role"}<select name="role" defaultValue={value}
    onChange={saveOnChange ? (event) => event.currentTarget.form?.requestSubmit() : undefined}>
    {(elevated ? ["PARTICIPANT", "MANAGER", "ADMIN"] : ["PARTICIPANT"]).map((role) => <option key={role} value={role}>{projectRoleLabels[role]}</option>)}
  </select></label>;
}

/** Only roles above the default get a badge (Owner, Admin or Manager), next to whether they are away. */
function MemberBadges({ member, owner }: { member: WorkspaceProject["members"][number]; owner: boolean }) {
  const role = owner ? "Owner" : member.role === "PARTICIPANT" ? null : projectRoleLabels[member.role];
  if (!role && !member.availability) return null;
  return <span className="member-badges">
    {role && <span className="role-badge">{role}</span>}
    {member.availability && <AvailabilityBadge availability={member.availability} />}
  </span>;
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

export default function ProjectsView({ projects, today }: { projects: WorkspaceProject[]; today: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const selected = search.get("project");
  const project = projects.find((p) => String(p.id) === selected);
  const [modal, setModal] = useState<"create" | "edit" | "add" | "task" | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const editingTask = project?.tasks.find((task) => task.id === editingTaskId);
  const close = () => { setModal(null); setEditingTaskId(null); };
  // On a project page the breadcrumb takes the label line above the title.
  const breadcrumbs = <nav className="project-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li><Link href="/?view=projects">Projects</Link></li>
      <li><span className="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">{project?.name ?? "Unavailable project"}</span></li>
    </ol>
  </nav>;

  return <div className="projects-workspace">
    {!selected ? <>
      <PageHeader title="Projects"
        actions={<button className="primary-button" onClick={() => setModal("create")}><span aria-hidden="true">+</span> New project</button>} />
      {projects.length === 0 ? <section className="project-empty-state"><span aria-hidden="true">↗</span><h2>Make room for your next idea</h2><p>Create a project and bring your team together.</p><button className="primary-button" onClick={() => setModal("create")}>Create your first project</button></section> :
        <ProjectBrowser projects={projects} today={today} />}
    </> : !project ? <>{breadcrumbs}<section className="project-empty-state"><h1>Project unavailable</h1><p>This project was deleted or you no longer have access.</p><Link href="/?view=projects" className="secondary-button">Back to projects</Link></section></> : <>
      <PageHeader breadcrumbs={breadcrumbs} title={project.name}
        actions={project.canEdit && <button className="secondary-button" onClick={() => setModal("edit")}>Edit project</button>} />
      <ProjectStages key={"stages-" + project.id} project={project} />
      <ProjectTaskList key={project.id} project={project}
        onCreate={() => { setEditingTaskId(null); setModal("task"); }}
        onEdit={(id) => { setModal(null); setEditingTaskId(id); }} />
      <section className="workspace-card project-team" key={"people-" + project.id}>
          <div className="section-heading"><div><h2>People <span className="role-badge">{project.members.length}</span></h2><p>The team making it happen.</p></div>{project.canManage && <button className="primary-button" onClick={() => setModal("add")}>Add member</button>}</div>
          {project.members.length === 0 && <p>No team members yet.</p>}
          <ul className="member-list">{project.members.map((member) => <li key={member.id}>
            <div className="member-identity"><UserAvatar id={member.id} firstName={member.first_name} lastName={member.last_name} photoVersion={member.photoVersion} /><div><strong>{member.first_name} {member.last_name}</strong><small>{[member.jobTitle, member.email].filter(Boolean).join(" · ")}</small>
              <MemberBadges member={member} owner={member.id === project.owner_id} />
              {member.status && <div className="member-status"><StatusText status={member.status} /></div>}
            </div></div>
            {project.canManage && member.id !== project.owner_id && (project.canAssignRoles || member.role === "PARTICIPANT") && <details className="member-settings"><summary>Manage</summary><div className="member-controls">
              {project.canAssignRoles && <ChangeForm operation="role" projectId={project.id} className="compact-form"><input type="hidden" name="user_id" value={member.id} /><RoleSelect elevated value={member.role} saveOnChange /></ChangeForm>}
              <ChangeForm operation="remove" projectId={project.id} className="compact-form" onSubmit={(event) => { if (!window.confirm(`Remove ${member.first_name} from this project?`)) event.preventDefault(); }}>
                <input type="hidden" name="user_id" value={member.id} /><button className="text-button danger">Remove from project</button>
              </ChangeForm>
            </div></details>}
          </li>)}</ul>
      </section>
      {project.canDelete && <details className="project-danger-zone"><summary>Project settings</summary><p>Deleting this project also deletes its tasks and memberships.</p><ChangeForm operation="delete" projectId={project.id} onSuccess={() => router.push("/?view=projects")} onSubmit={(event) => { if (!window.confirm(`Permanently delete “${project.name}” and all its tasks?`)) event.preventDefault(); }}><button className="danger-button">Delete project</button></ChangeForm></details>}
    </>}

    {/* The same in-place editor as a card on the Tasks board. */}
    {editingTask && project?.canManageTasks && <TaskDetailsForm key={"task-" + editingTask.id} project={project} task={editingTask}
      overdue={isTaskOverdue(editingTask, today)} showOpenProject={false} onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {modal === "task" && project?.canManageTasks && <TaskDetailsForm project={project} showOpenProject={false}
      onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {/* The same in-place style as the task dialog. */}
    {modal === "create" && <ProjectDetailsForm onClose={close} onSaved={(id) => { close(); router.push(`/?project=${id}`); }} />}
    {modal === "edit" && project && <ProjectDetailsForm key={"edit-" + project.id} project={project} onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {modal === "add" && project && <ProjectDialog title="Bring someone on board" description={`Add a registered user to ${project.name}.`} onClose={close}>
      {project.eligible.length === 0 ? <p>There are no other available users to add.</p> : <ChangeForm operation="add" projectId={project.id} onSuccess={close}>
        <label>Available users<select name="user_id" required defaultValue=""><option value="" disabled>Select a user</option>{project.eligible.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email}){user.availability ? ` · ${user.availability.label}` : ""}</option>)}</select></label>
        <RoleSelect elevated={project.canAssignRoles} /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button">Add member</button></div>
      </ChangeForm>}
    </ProjectDialog>}
  </div>;
}
