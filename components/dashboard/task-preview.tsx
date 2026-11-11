"use client";

import Link from "next/link";
import TaskDetailsDialog from "@/app/task-details-dialog";
import details from "@/components/ui/details-dialog.module.css";
import { formatTaskDeadline, taskPriorityLabels, taskStatusLabels } from "@/lib/tasks/labels";

export type PreviewTask = {
  id: number; title: string; description: string | null; status: string; priority: string; deadline: string;
  overdue: boolean; stageName: string; assigneeName: string; projectId: number; projectName: string;
};

/**
 * A quick look at a task from the dashboard, without leaving it: the details,
 * plus a way through to the task board or the project when more is needed.
 */
export default function TaskPreview({ task, onClose }: { task: PreviewTask; onClose: () => void }) {
  return <TaskDetailsDialog title={task.title} onClose={onClose}>
    <p className={details.detailsContext}>{task.projectName} · {task.stageName}</p>
    <p className={task.description ? details.detailsDescription : details.detailsEmpty}>
      {task.description || "No description yet."}
    </p>
    <dl className={details.detailsFacts}>
      <div><dt>Status</dt><dd>{taskStatusLabels[task.status]}</dd></div>
      <div><dt>Priority</dt><dd>{taskPriorityLabels[task.priority]}</dd></div>
      <div><dt>Assigned to</dt><dd>{task.assigneeName}</dd></div>
      <div><dt>Deadline</dt><dd style={task.overdue ? { color: "var(--critical)" } : undefined}>
        {formatTaskDeadline(task.deadline)}{task.overdue ? " · overdue" : ""}
      </dd></div>
    </dl>
    <div className="dialog-actions">
      <Link className="secondary-button" href={`/?project=${task.projectId}`}>Open project</Link>
      <Link className="primary-button" href={`/?view=tasks&in=${task.projectId}`}>Open in Tasks</Link>
    </div>
  </TaskDetailsDialog>;
}
