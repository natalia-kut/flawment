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
import ProjectSpecializations, { MemberSpecialization } from "./project-specializations";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode, type FormEventHandler } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectAction } from "@/lib/projects/actions";
import PageHeader from "@/components/page-header";
import { projectStatusLabels } from "@/lib/projects/labels";

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
      <div className="project-detail-layout">
        <section className="workspace-card project-team" key={project.id}>
          <div className="section-heading"><div><h2>People <span className="role-badge">{project.members.length}</span></h2><p>The team making it happen.</p></div>{project.canManage && <button className="primary-button" onClick={() => setModal("add")}>Add member</button>}</div>
          {project.members.length === 0 && <p>No team members yet.</p>}
          <ul className="member-list">{project.members.map((member) => <li key={member.id}>
            <div className="member-identity"><UserAvatar id={member.id} firstName={member.first_name} lastName={member.last_name} photoVersion={member.photoVersion} /><div><strong>{member.first_name} {member.last_name}</strong><small>{[member.jobTitle, member.email].filter(Boolean).join(" · ")}</small><span className="role-badge">{member.role}{member.id === project.owner_id ? " · Owner" : ""}</span>
              {member.specializationName && <span className="specialization-badge">{member.specializationName}</span>}
              {member.availability && <AvailabilityBadge availability={member.availability} />}
              {member.status && <div className="member-status"><StatusText status={member.status} /></div>}
              <details className="member-bio"><summary>About</summary>
                {(member.teamName || member.birthday || member.phone || member.location || member.workingHours) && <ul className="member-facts">
                  {member.teamName && <li><span>Team</span>{member.teamName}</li>}
                  {member.birthday && <li><span>Birthday</span>{member.birthday}</li>}
                  {member.phone && <li><span>Phone</span>{member.phone}</li>}
                  {member.location && <li><span>Location</span>{member.location}</li>}
                  {member.workingHours && <li><span>Hours</span>{member.workingHours}</li>}
                </ul>}
                {member.skills.length > 0 ? <ul className="skill-list" aria-label="Skills">{member.skills.map((s) => <li key={s} className="skill-chip">{s}</li>)}</ul>
                  : !(member.teamName || member.birthday || member.phone || member.location || member.workingHours) && <p>Nothing shared yet.</p>}
              </details>
              {project.canManageSpecializations && <details className="member-bio"><summary>Assign specialization</summary><MemberSpecialization project={project} member={member} /></details>}
            </div></div>
            {project.canManage && member.id !== project.owner_id && (project.canAssignRoles || member.role === "PARTICIPANT") && <details className="member-settings"><summary>Manage</summary><div className="member-controls">
              {project.canAssignRoles && <ChangeForm operation="role" projectId={project.id} className="compact-form"><input type="hidden" name="user_id" value={member.id} /><RoleSelect elevated value={member.role} /><button className="secondary-button">Save role</button></ChangeForm>}
              <ChangeForm operation="remove" projectId={project.id} className="compact-form" onSubmit={(event) => { if (!window.confirm(`Remove ${member.first_name} from this project?`)) event.preventDefault(); }}>
                <input type="hidden" name="user_id" value={member.id} /><button className="danger-button">Remove member</button>
              </ChangeForm>
            </div></details>}
          </li>)}</ul>
        </section>
        <aside className="project-overview-sidebar">
          <ProjectSpecializations project={project} />
          <section className="workspace-card project-facts"><h2>At a glance</h2><dl><div><dt>Status</dt><dd>{projectStatusLabels[project.status]}</dd></div><div><dt>Start date</dt><dd>{project.start_date}</dd></div><div><dt>End date</dt><dd>{project.end_date || "No deadline"}</dd></div><div><dt>Your role</dt><dd>{project.role?.replaceAll("_", " ")}</dd></div></dl></section>
          {project.canDelete && <details className="project-danger-zone"><summary>Project settings</summary><p>Deleting this project also deletes its tasks and memberships.</p><ChangeForm operation="delete" projectId={project.id} onSuccess={() => router.push("/?view=projects")} onSubmit={(event) => { if (!window.confirm(`Permanently delete “${project.name}” and all its tasks?`)) event.preventDefault(); }}><button className="danger-button">Delete project</button></ChangeForm></details>}
        </aside>
      </div>
    </>}

    {/* The same in-place editor as a card on the Tasks board. */}
    {editingTask && project?.canManageTasks && <TaskDetailsForm key={editingTask.id} project={project} task={editingTask}
      overdue={isTaskOverdue(editingTask, today)} showOpenProject={false} onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {modal === "task" && project?.canManageTasks && <TaskDetailsForm project={project} showOpenProject={false}
      onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {/* The same in-place style as the task dialog. */}
    {modal === "create" && <ProjectDetailsForm onClose={close} onSaved={(id) => { close(); router.push(`/?project=${id}`); }} />}
    {modal === "edit" && project && <ProjectDetailsForm key={project.id} project={project} onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {modal === "add" && project && <ProjectDialog title="Bring someone on board" description={`Add a registered user to ${project.name}.`} onClose={close}>
      {project.eligible.length === 0 ? <p>There are no other available users to add.</p> : <ChangeForm operation="add" projectId={project.id} onSuccess={close}>
        <label>Available users<select name="user_id" required defaultValue=""><option value="" disabled>Select a user</option>{project.eligible.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email}){user.availability ? ` · ${user.availability.label}` : ""}</option>)}</select></label>
        <RoleSelect elevated={project.canAssignRoles} /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button">Add member</button></div>
      </ChangeForm>}
    </ProjectDialog>}
  </div>;
}
