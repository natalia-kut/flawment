import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";
import { isManagerialTitle } from "@/lib/people/job-titles";
import { workspaceDay } from "@/lib/time-off/dates";

const name = (user: { first_name: string; last_name: string }) => `${user.first_name} ${user.last_name}`;

/** Requests waiting for a super admin, oldest first, with what approving one would change. */
export async function getPendingTitleRequests(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN") return [];
  const [requests, titles] = await Promise.all([
    prisma.jobTitleRequest.findMany({
      where: { status: "PENDING" }, orderBy: { created_at: "asc" },
      select: {
        id: true, title: true, note: true, created_at: true,
        user: { select: { id: true, first_name: true, last_name: true, photo_updated_at: true, team_lead: true, job_title: { select: { name: true } }, team: { select: { name: true } } } },
        requester: { select: { first_name: true, last_name: true } },
      },
    }),
    prisma.jobTitle.findMany({ select: { name_key: true, can_lead: true } }),
  ]);
  return requests.map((r) => {
    const existing = titles.find((t) => t.name_key === r.title.toLowerCase());
    const canLead = existing ? existing.can_lead : isManagerialTitle(r.title);
    return {
      id: r.id, title: r.title, note: r.note, /** The workspace day it was sent (YYYY-MM-DD). */ createdOn: workspaceDay(r.created_at),
      person: name(r.user), personId: r.user.id, firstName: r.user.first_name, lastName: r.user.last_name,
      photoVersion: r.user.photo_updated_at?.toISOString() ?? null, currentTitle: r.user.job_title?.name ?? null, team: r.user.team?.name ?? null,
      requester: name(r.requester),
      /** The title is not on the list yet: approving adds it. */
      isNewTitle: !existing,
      canLead,
      /** Approving takes their lead role away. */
      endsLead: r.user.team_lead && !canLead,
    };
  });
}

/** What a team lead needs: for each person in their team, the request waiting, or the last decision. */
export async function getLeadTitleRequests(actor: Actor) {
  const lead = await prisma.user.findUnique({ where: { id: actor.id }, select: { team_id: true, team_lead: true } });
  if (!lead?.team_lead || lead.team_id === null) return { byPerson: {} };
  const requests = await prisma.jobTitleRequest.findMany({
    where: { user: { team_id: lead.team_id } }, orderBy: { created_at: "desc" },
    select: { id: true, user_id: true, title: true, status: true, decided_at: true, requested_by: true },
  });
  const byPerson: Record<number, { id: number; title: string; status: "PENDING" | "APPROVED" | "DECLINED"; decidedAt: string | null; mine: boolean }> = {};
  for (const r of requests) {
    byPerson[r.user_id] ??= { id: r.id, title: r.title, status: r.status, decidedAt: r.decided_at?.toISOString() ?? null, mine: r.requested_by === actor.id };
  }
  return { byPerson };
}

/**
 * Approved job title changes this month, newest first: everyone may congratulate.
 * Job titles are no secret in the directory, so neither is a new one.
 */
export async function getPromotions(today: string) {
  const month = today.slice(0, 7);
  // A day early, so the start of the month in Warsaw is never cut off by UTC.
  const since = new Date(Date.parse(month + "-01") - 86_400_000);
  const approved = await prisma.jobTitleRequest.findMany({
    where: { status: "APPROVED", decided_at: { gte: since }, user: { is_active: true } },
    orderBy: { decided_at: "desc" }, select: { id: true, user_id: true, title: true, decided_at: true },
  });
  return approved.filter((r) => workspaceDay(r.decided_at!).startsWith(month))
    .map((r) => ({ id: r.id, personId: r.user_id, title: r.title }));
}

export type PendingTitleRequest = Awaited<ReturnType<typeof getPendingTitleRequests>>[number];
export type LeadTitleRequests = Awaited<ReturnType<typeof getLeadTitleRequests>>;
export type Promotion = Awaited<ReturnType<typeof getPromotions>>[number];
