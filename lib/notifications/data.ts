import { prisma } from "@/lib/prisma";
import { visibleProjects, type Actor } from "@/lib/rbac";
import type { Prisma } from "@/src/generated/prisma/client";
import type { NotificationItem } from "./labels";

/** How many the bell lists; older ones stay counted until read. */
export const NOTIFICATION_PAGE = 30;
/** Read notifications older than this are cleared away. */
const KEEP_READ_DAYS = 90;

const name = (user: { first_name: string; last_name: string } | null) => user ? `${user.first_name} ${user.last_name}` : null;

/**
 * Only what the person may still see: a task or project they have since lost
 * access to drops out, as it does everywhere else, and so do job title requests
 * once they no longer decide them.
 */
export function visibleNotifications(actor: Actor): Prisma.NotificationWhereInput {
  const projects = visibleProjects(actor);
  return {
    user_id: actor.id,
    AND: [
      { OR: [{ task_id: null }, { task: { project: projects } }] },
      { OR: [{ project_id: null }, { project: projects }] },
      ...(actor.role === "SUPER_ADMIN" ? [] : [{ type: { not: "TITLE_REQUEST" as const } }]),
    ],
  };
}

export async function getNotifications(actor: Actor, now = new Date()): Promise<{ unread: number; items: NotificationItem[] }> {
  await prisma.notification.deleteMany({
    where: { user_id: actor.id, read_at: { lt: new Date(now.getTime() - KEEP_READ_DAYS * 86_400_000) } },
  });
  const where = visibleNotifications(actor);
  const [unread, rows] = await Promise.all([
    prisma.notification.count({ where: { ...where, read_at: null } }),
    prisma.notification.findMany({
      where, orderBy: [{ created_at: "desc" }, { id: "desc" }], take: NOTIFICATION_PAGE,
      select: {
        id: true, type: true, status: true, created_at: true, read_at: true,
        actor: { select: { first_name: true, last_name: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        title_request: { select: { title: true, status: true, user: { select: { first_name: true, last_name: true } } } },
      },
    }),
  ]);
  return {
    unread,
    items: rows.map((row) => ({
      id: row.id, type: row.type, actor: name(row.actor), task: row.task, project: row.project,
      request: row.title_request && { person: name(row.title_request.user)!, title: row.title_request.title, status: row.title_request.status },
      status: row.status, createdAt: row.created_at.toISOString(), read: row.read_at !== null,
    })),
  };
}

/** Marks some of your notifications read, or all of them; someone else's ids change nothing. */
export async function markNotificationsRead(userId: number, ids: number[] | "all", now = new Date()) {
  const { count } = await prisma.notification.updateMany({
    where: { user_id: userId, read_at: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
    data: { read_at: now },
  });
  return count;
}
