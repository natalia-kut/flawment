import type { Actor } from "@/lib/rbac";
import type { WorkspaceProject } from "@/lib/projects/data";
import { getTaskDetails } from "@/lib/tasks/details";
import TaskPage, { TaskUnavailable } from "./task-page";
import type { CommentViewer } from "./task-comments";

/** The page behind a task link (/?task=ID). `projects` are the ones this user may see. */
export default async function TaskSection({ taskId, projects, user, today }: {
  taskId: string; projects: WorkspaceProject[]; user: Actor & CommentViewer; today: string;
}) {
  const project = projects.find((item) => item.tasks.some((task) => String(task.id) === taskId));
  const task = project?.tasks.find((item) => String(item.id) === taskId);
  const details = task && await getTaskDetails(user, task.id);
  if (!project || !task || !details) return <TaskUnavailable />;
  const viewer = { id: user.id, first_name: user.first_name, last_name: user.last_name, photoVersion: user.photoVersion };
  // The key starts the page afresh (drafts included) when another task is opened.
  return <TaskPage key={task.id} project={project} task={task} details={details} viewer={viewer} today={today} />;
}
