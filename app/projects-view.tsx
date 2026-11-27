"use client";

import Link from "next/link";
import TaskDetailsForm from "./task-details-form";
import ProjectDetailsForm from "./project-details-form";
import { isTaskOverdue } from "@/lib/tasks/board";
import ProjectTaskList from "./project-task-list";
import ProjectStages from "./project-stages";
import ProjectBrowser from "./project-browser";
import ProjectSummary from "./project-summary";
import UserAvatar from "./user-avatar";
import { PersonButton } from "./people-context";
import AvailabilityBadge from "./availability-badge";
import { StatusText } from "./status-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode, type FormEventHandler } from "react";
import type { WorkspaceProject } from "@/lib/projects/data";
import { projectAction } from "@/lib/projects/actions";
import { projectRoleLabels } from "@/lib/projects/labels";
import type { ProjectRole } from "@/src/generated/prisma/enums";
import PageHeader from "@/components/page-header";
import Tabs from "@/components/ui/tabs";
import { useConfirmSubmit } from "@/components/ui/confirm";
import EmptyState from "@/components/ui/empty-state";
import people from "./project-people.module.css";
import { submitInPlace } from "@/components/ui/submit-in-place";
import { closeOnBackdrop } from "@/components/ui/backdrop";
import { OFFLINE, reach } from "@/components/ui/offline";

function ChangeForm({ children, operation, projectId, onSubmit, onSuccess, className = "workspace-form", id }: {
  children?: ReactNode; operation: string; projectId?: number; id?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>; onSuccess?: (projectId?: number) => void; className?: string;
}) {
  const [state, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof projectAction>>, data: FormData) => {
    const result = await reach(() => projectAction(previous, data), { error: OFFLINE });
    if (result.success) onSuccess?.(result.projectId);
    return result;
  }, {});
  return <form id={id} action={action} className={className} onSubmit={submitInPlace(action, onSubmit)}>
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
  return <label>{saveOnChange ? "Role" : "Project role"}<select key={value} name="role" defaultValue={value}
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
    onCancel={onClose} {...closeOnBackdrop(onClose)}>
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
  // A dialog belongs to the project it was opened on: leaving it (a deletion, Back) closes it,
  // so the next project never opens with another project's dialog showing.
  const [dialogProject, setDialogProject] = useState(selected);
  if (dialogProject !== selected) {
    setDialogProject(selected);
    close();
  }
  // What deleting the project or removing a member takes with it, so the confirmations can say so.
  const assignedTo = (memberId: number) => project?.tasks.filter((task) => task.assignedTo === memberId).length ?? 0;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  // On a project page the breadcrumb takes the label line above the title.
  const breadcrumbs = <nav className="project-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li><Link href="/?view=projects">Projects</Link></li>
      <li><span className="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">{project?.name ?? "Unavailable project"}</span></li>
    </ol>
  </nav>;

  return <div className="projects-workspace">
    {!selected ? <>
      {/* With no projects yet, the empty page has the button instead. */}
      <PageHeader title="Projects"
        actions={canCreateProjects && projects.length > 0 && <button className="primary-button" onClick={() => setModal("create")}><span aria-hidden="true">+</span> New project</button>} />
      {projects.length === 0 ? (canCreateProjects
        ? <EmptyState art="projects" title="Make room for your next idea"
          action={<button className="primary-button" onClick={() => setModal("create")}><span aria-hidden="true">+</span> Create your first project</button>}>
          Create a project and bring your team together.</EmptyState>
        : <EmptyState art="projects" title="No projects yet">When a manager adds you to a project, it will show up here.</EmptyState>) :
        <ProjectBrowser projects={projects} today={today} />}
    </> : !project ? <>{breadcrumbs}<section className="project-empty-state"><h1>Project unavailable</h1><p>This project was deleted or you no longer have access.</p><Link href="/?view=projects" className="secondary-button">Back to projects</Link></section></> : <>
      <PageHeader breadcrumbs={breadcrumbs} title={project.name} description={project.description}
        actions={project.canEdit && <button className="secondary-button" onClick={() => setModal("edit")}>Edit project</button>} />
      <ProjectSummary project={project} today={today} />
      {/* One part at a time, so the page never becomes one long list. */}
      <Tabs key={project.id} label={project.name} tabs={[
        { key: "tasks", label: "Tasks", count: project.tasks.length, content: <ProjectTaskList project={project} today={today}
          onCreate={() => { setEditingTaskId(null); setModal("task"); }}
          onEdit={(id) => { setModal(null); setEditingTaskId(id); }} /> },
        { key: "stages", label: "Stages", count: project.stages.length, content: <ProjectStages project={project} today={today} /> },
        { key: "people", label: "People", count: project.members.length, content: <section className="workspace-card project-team" aria-labelledby="project-people-heading">
            <div className="section-heading"><h2 id="project-people-heading">Working on this project</h2>{project.canManage && <button className="primary-button" onClick={() => setModal("add")}><span aria-hidden="true">+</span> Add member</button>}</div>
            {project.members.length === 0 && <p>No team members yet.</p>}
            {/* A tile each: face, name and project role, job title, then whether they are away or busy. */}
            <ul className={people.grid}>{project.members.map((member) => <li key={member.id} className={people.member} title={member.email}>
              <UserAvatar id={member.id} firstName={member.first_name} lastName={member.last_name} photoVersion={member.photoVersion} size={40} />
              <div className={people.info}>
                <p className={people.name}><PersonButton id={member.id} name={member.first_name + " " + member.last_name} className={people.nameLink}><strong>{member.first_name} {member.last_name}</strong></PersonButton></p>
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
                <ChangeForm operation="remove" projectId={project.id} className="compact-form" onSubmit={confirmSubmit({ title: `Remove ${member.first_name} from this project?`, message: assignedTo(member.id)
                  ? `They lose access to this project, and their ${plural(assignedTo(member.id), "task")} here (finished ones included) become unassigned.`
                  : "They lose access to this project.", confirm: "Remove" })}>
                  <input type="hidden" name="user_id" value={member.id} /><button className="text-button danger">Remove from project</button>
                </ChangeForm>
              </div></ManageMenu>}
            </li>)}</ul>
          </section> },
      ]} />
    </>}

    {/* The same in-place editor as a card on the Tasks board. */}
    {editingTask?.canEdit && project && <TaskDetailsForm key={"task-" + editingTask.id} project={project} task={editingTask}
      overdue={isTaskOverdue(editingTask, today)} showOpenProject={false} onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {modal === "task" && project?.canCreateTasks && <TaskDetailsForm project={project} showOpenProject={false}
      onClose={close} onSaved={() => { close(); router.refresh(); }} />}
    {/* The same in-place style as the task dialog. */}
    {modal === "create" && <ProjectDetailsForm onClose={close} onSaved={(id) => { close(); router.push(`/?project=${id}`); }} />}
    {modal === "edit" && project && <ProjectDetailsForm key={"edit-" + project.id} project={project} onClose={close} onSaved={() => { close(); router.refresh(); }}
      // Its own form (forms cannot nest); the dialog's "Delete project" button submits it by id.
      deletion={project.canDelete ? { formId: "delete-project-" + project.id, form: <ChangeForm id={"delete-project-" + project.id} operation="delete" projectId={project.id}
        className="compact-form" onSuccess={() => { close(); router.push("/?view=projects"); }}
        onSubmit={confirmSubmit({ title: `Delete “${project.name}”?`, message: `Everything in it goes too: ${plural(project.tasks.length, "task")} with their comments and files, ${plural(project.stages.length, "stage")}, the document templates made for it and everyone's membership. This cannot be undone.`, confirm: "Delete project" })} /> } : undefined} />}
    {modal === "add" && project && <ProjectDialog title="Bring someone on board" description={`Add a registered user to ${project.name}.`} onClose={close}>
      {project.eligible.length === 0 ? <p>There are no other available users to add.</p> : <ChangeForm operation="add" projectId={project.id} onSuccess={close}>
        <label>Available users<select name="user_id" required defaultValue=""><option value="" disabled>Select a user</option>{project.eligible.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.email}){user.availability ? ` · ${user.availability.label}` : ""}</option>)}</select></label>
        <RoleSelect canNameCoordinators={project.canAssignRoles} /><div className="dialog-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button">Add member</button></div>
      </ChangeForm>}
    </ProjectDialog>}
  </div>;
}
