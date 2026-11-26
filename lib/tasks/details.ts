import { prisma } from "@/lib/prisma";
import { visibleProjects, type Actor } from "@/lib/rbac";

// Formatted on the server, in the workspace's time zone, so it reads the same for everyone.
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Warsaw" });
const moment = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
});

const personSelect = { id: true, first_name: true, last_name: true, role: true, photo_updated_at: true } as const;
type PersonRow = { id: number; first_name: string; last_name: string; role: string; photo_updated_at: Date | null };

/** Super admins stay anonymous to standard users, here as everywhere else. */
function person(row: PersonRow | null, viewer: Actor) {
  if (!row) return { id: null, firstName: "Former", lastName: "member", photoVersion: null };
  if (row.role === "SUPER_ADMIN" && viewer.role !== "SUPER_ADMIN") {
    return { id: null, firstName: "Administrator", lastName: "", photoVersion: null };
  }
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, photoVersion: row.photo_updated_at?.toISOString() ?? null };
}

/** What only the task's own page shows: who added it, when, its files and the discussion. */
export async function getTaskDetails(viewer: Actor, taskId: number) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: visibleProjects(viewer) },
    select: {
      created_at: true, updated_at: true, completed_at: true, creator: { select: personSelect },
      files: {
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
        select: { id: true, name: true, type: true, size: true, created_at: true, uploader_id: true, uploader: { select: personSelect } },
      },
      comments: {
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
        select: { id: true, author_id: true, parent_id: true, body: true, created_at: true, edited_at: true, deleted_at: true, author: { select: personSelect } },
      },
    },
  });
  if (!task) return null;
  const comments = task.comments.map((comment) => ({
    id: comment.id, parentId: comment.parent_id, isReply: comment.parent_id !== null,
    body: comment.body, deleted: comment.deleted_at !== null,
    author: person(comment.deleted_at ? null : comment.author, viewer),
    mine: comment.author_id === viewer.id,
    postedAt: moment.format(comment.created_at),
    postedIso: comment.created_at.toISOString(),
    editedAt: comment.edited_at && moment.format(comment.edited_at),
  }));
  return {
    createdOn: day.format(task.created_at),
    updatedAt: moment.format(task.updated_at),
    completedOn: task.completed_at && day.format(task.completed_at),
    creator: person(task.creator, viewer),
    files: task.files.map((file) => ({
      id: file.id, name: file.name, size: file.size, isImage: file.type.startsWith("image/"),
      uploader: person(file.uploader, viewer), mine: file.uploader_id === viewer.id, addedOn: day.format(file.created_at),
    })),
    comments: comments.filter((comment) => !comment.isReply)
      .map((comment) => ({ ...comment, replies: comments.filter((reply) => reply.parentId === comment.id) })),
  };
}

export type TaskDetails = NonNullable<Awaited<ReturnType<typeof getTaskDetails>>>;
