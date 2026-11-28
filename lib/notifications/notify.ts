import type { Prisma } from "@/src/generated/prisma/client";
import type { NotificationType, TaskStatus } from "@/src/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

export type NotificationInput = {
  type: NotificationType;
  /** Who should hear of it; empty places, repeats and the actor themselves are dropped. */
  recipients: readonly (number | null | undefined)[];
  actorId: number;
  taskId?: number;
  projectId?: number;
  titleRequestId?: number;
  status?: TaskStatus;
};

/**
 * Records a notification inside the transaction that made the change, so it
 * exists exactly when the change does: a save that fails or is retried after a
 * conflict leaves no stray or doubled notification behind. Nobody is told of
 * their own change, and deactivated accounts are skipped.
 */
export async function notify(tx: Tx, { type, recipients, actorId, taskId, projectId, titleRequestId, status }: NotificationInput) {
  const ids = [...new Set(recipients.filter((id): id is number => typeof id === "number" && id !== actorId))];
  if (ids.length === 0) return 0;
  const active = await tx.user.findMany({ where: { id: { in: ids }, is_active: true }, select: { id: true } });
  if (active.length === 0) return 0;
  const { count } = await tx.notification.createMany({
    data: active.map(({ id }) => ({
      user_id: id, type, actor_id: actorId,
      task_id: taskId ?? null, project_id: projectId ?? null, title_request_id: titleRequestId ?? null, status: status ?? null,
    })),
  });
  return count;
}

/** Every active super admin: they decide job title requests. */
export async function administratorIds(tx: Tx) {
  const admins = await tx.user.findMany({ where: { role: "SUPER_ADMIN", is_active: true }, select: { id: true } });
  return admins.map(({ id }) => id);
}
