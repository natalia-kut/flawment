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
import type { ProjectRole } from "@/src/generated/prisma/enums";
import PageHeader from "@/components/page-header";
import { useConfirmSubmit } from "@/components/ui/confirm";
import people from "./project-people.module.css";

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

/**
 * Contributor, or Coordinator for whoever may name coordinators (the owner).
 * `saveOnChange` saves as soon as a role is picked; otherwise it is part of a form.
 */
function RoleSelect({ canNameCoordinators, value = "CONTRIBUTOR", saveOnChange = false }: { canNameCoordinators: boolean; value?: ProjectRole; saveOnChange?: boolean }) {
  const roles: ProjectRole[] = canNameCoordinators ? ["CONTRIBUTOR", "COORDINATOR"] : ["CONTRIBUTOR"];
  return <label>{saveOnChange ? "Role" : "Project role"}<select name="role" defaultValue={value}
    onChange={saveOnChange ? (event) => event.currentTarget.form?.requestSubmit() : undefined}>
    {roles.map((role) => <option key={role} value={role}>{projectRoleLabels[role]}</option>)}
  </select></label>;
}

/** "Manage" opens a small menu; clicking anywhere else or pressing Escape closes it. */
function ManageMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const menu = ref.current!;
    const close = (event: Event) => {
      if (!menu.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return <details ref={ref} className={`member-settings ${people.manage}`}>
    <summary title="Manage"><span aria-hidden="true">⋯</span><span className="visually-hidden">Manage</span></summary>{children}
  </details>;
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

export default function ProjectsView({ projects, today, canCreateProjects }: {
  projects: WorkspaceProject[]; today: string;
  /** Managers (a managerial job title) and super admins start projects. */
  canCreateProjects: boolean;
}) {
  const router = useRouter();
  const confirmSubmit = useConfirmSubmit();
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
        actions={canCreateProjects && <button className="primary-button" onClick={() => setModal("create")}><span aria-hidden="true">+</span> New project</button>} />
      {projects.length === 0 ? <section className="project-empty-state"><span aria-hidden="true">↗</span>{canCreateProjects ? <><h2>Make room for your next idea</h2><p>Create a project and bring your team together.</p><button className="primary-button" onClick={() => setModal("create")}>Create your first project</button></>
        : <><h2>No projects yet</h2><p>When a manager adds you to a project, it will show up here.</p></>}</section> :
        <ProjectBrowser projects={projects} today={today} />}
    </> : !project ? <>{breadcrumbs}<section className="project-empty-state"><h1>Project unavailable</h1><p>This project was deleted or you no longer have access.</p><Link href="/?view=projects" className="secondary-button">Back to projects</Link></section></> : <>
      <PageHeader breadcrumbs={breadcrumbs} title={project.name}
        actions={project.canEdit && <button className="secondary-button" onClick={() => setModal("edit")}>Edit project</button>} />
      <ProjectStages key={"stages-" + project.id} project={project} />
      <ProjectTaskList key={project.id} project={project} today={today}
        onCreate={() => { setEditingTaskId(null); setModal("task"); }}
        onEdit={(id) => { setModal(null); setEditingTaskId(id); }} />
      <section className="workspace-card project-team" key={"people-" + project.id}>
          <div className="section-heading"><div><h2>Working on this project <span className="role-badge">{project.members.length}</span></h2></div>{project.canManage && <button className="primary-button" onClick={() => setModal("add")}><span aria-hidden="true">+</span> Add member</button>}</div>
          {project.members.length === 0 && <p>No team members yet.</p>}
          {/* A tile each: face, name and project role, job title, then whether they are away or busy. */}
          <ul className={people.grid}>{project.members.map((member) => <li key={member.id} className={people.member} title={member.email}>
            <UserAvatar id={member.id} firstName={member.first_name} lastName={member.last_name} photoVersion={member.photoVersion} size={40} />
            <div className={people.info}>
              <p className={people.name}><strong>{member.first_name} {member.last_name}</strong></p>
              {/* A line each: the project role (when above contributor), then the job title. */}
              {member.role !== "CONTRIBUTOR" && <span className={people.role} data-role={member.role}>{projectRoleLabels[member.role]}</span>}
              <p className={people.title}>{member.jobTitle ?? "No job title"}</p>
              {(member.availability || member.status) && <div className={people.extra}>
                {member.availability && <AvailabilityBadge availability={member.availability} />}
                {member.status && <StatusText status={member.status} />}
              </div>}
            </div>
            {project.canManage && member.id !== project.owner_id && (project.canAssignRoles || member.role === "CONTRIBUTOR") && <ManageMenu><div className="member-controls">
              {project.canAssignRoles && <ChangeForm operation="role" projectId={project.id} className="compact-form"><input type="hidden" name="user_id" value={member.id} /><RoleSelect canNameCoordinators value={member.role} saveOnChange /></ChangeForm>}
              <ChangeForm operation="remove" projectId={project.id} className="compact-form" onSubmit={confirmSubmit({ title: `Remove ${member.first_name} from this project?`, message: "They lose access to this project.", confirm: "Remove" })}>
                <input type="hidden" name="user_id" value={member.id} /><button className="text-button danger">Remove from project</button>
              </ChangeForm>
            </div></ManageMenu>}
          </li>)}</ul>
      </section>
    </>}

    {/* The same in-place editor as a card on the Tasks board. */}
    {editingTask?.canEdit && project && <TaskDetailsForm key={"task-" + editingTask.id} project={project} task={editingTask}
      overdue={isTaskOverdue(editingTask, today)} showOpenProject={false} onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {modal === "task" && project?.canCreateTasks && <TaskDetailsForm project={project} showOpenProject={false}
      onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {/* The same in-place style as the task dialog. */}
    {modal === "create" && <ProjectDetailsForm onClose={close} onSaved={(id) => { close(); router.push(`/?project=${id}`); }} />}
    {modal === "edit" && project && <ProjectDetailsForm key={"edit-" + project.id} project={project} onClose={close} onSaved={() => { close(); router.refresh(); }}
      footer={project.canDelete && <ChangeForm operation="delete" projectId={project.id} className="compact-form" onSuccess={() => router.push("/?view=projects")}
        onSubmit={confirmSubmit({ title: `Delete “${project.name}”?`, message: "Its tasks, stages and memberships go with it. This cannot be undone.", confirm: "Delete project" })}>
        <button className="text-button danger">Delete project</button>
      </ChangeForm>} />}
    {modal === "add" && project && <ProjectDialog title="Bring someone on board" description={`Add a registered user to ${project.name}.`} onClose={close}>
      {project.eligible.length === 0 ? <p>There are no other available users to add.</p> : <ChangeForm operation="add" projectId={project.id} onSuccess={close}>
        <label>Available users<select name="user_id" required defaultValue=""><option value="" disabled>Select a user</option>{project.eligible.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email}){user.availability ? ` · ${user.availability.label}` : ""}</option>)}</select></label>
        <RoleSelect canNameCoordinators={project.canAssignRoles} /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button">Add member</button></div>
      </ChangeForm>}
    </ProjectDialog>}
  </div>;
}
