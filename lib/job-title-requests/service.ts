import type { Actor } from "@/lib/rbac";
import { findOrCreateJobTitle } from "@/lib/people/service";
import { serializable } from "@/lib/transaction";
import { administratorIds, notify } from "@/lib/notifications/notify";

export class TitleRequestError extends Error {}

const clean = (value: FormDataEntryValue | null) => String(value ?? "").trim().replace(/\s+/g, " ");

function recordId(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new TitleRequestError("Invalid record ID.");
  return Number(text);
}

/**
 * A team lead suggests a new job title for someone in their team; a super admin decides.
 * One request waits per person: a new one replaces the lead's earlier suggestion.
 */
export async function mutateTitleRequest(actor: Actor, data: FormData) {
  const operation = String(data.get("operation") ?? "");
  return serializable(async (tx) => {
    if (operation === "request") {
      const userId = recordId(data.get("user_id"));
      const title = clean(data.get("title")), note = clean(data.get("note"));
      if (!title || title.length > 80) throw new TitleRequestError("Use a job title between 1 and 80 characters.");
      if (note.length > 300) throw new TitleRequestError("Keep the reason under 300 characters.");
      const [lead, person] = await Promise.all([
        tx.user.findUnique({ where: { id: actor.id }, select: { team_id: true, team_lead: true } }),
        tx.user.findUnique({ where: { id: userId }, select: { team_id: true, is_active: true, role: true, job_title: { select: { name: true } } } }),
      ]);
      // Only a team's lead speaks for its people, and not for themselves.
      if (!lead?.team_lead || lead.team_id === null || userId === actor.id || !person?.is_active || person.role !== "USER" || person.team_id !== lead.team_id) {
        throw new TitleRequestError("Only the lead of their team can suggest a new job title.");
      }
      if (person.job_title?.name.toLowerCase() === title.toLowerCase()) throw new TitleRequestError("This is already their job title.");
      const pending = await tx.jobTitleRequest.findFirst({ where: { user_id: userId, status: "PENDING" }, select: { id: true } });
      const values = { title, note: note || null, requested_by: actor.id, created_at: new Date() };
      const saved = pending
        ? await tx.jobTitleRequest.update({ where: { id: pending.id }, data: values, select: { id: true } })
        : await tx.jobTitleRequest.create({ data: { ...values, user_id: userId }, select: { id: true } });
      await notify(tx, { type: "TITLE_REQUEST", recipients: await administratorIds(tx), actorId: actor.id, titleRequestId: saved.id });
      return saved;
    }

    const requestId = recordId(data.get("request_id"));
    const request = await tx.jobTitleRequest.findUnique({ where: { id: requestId }, select: { status: true, user_id: true, requested_by: true, title: true } });
    if (!request || request.status !== "PENDING") throw new TitleRequestError("This request has already been dealt with.");

    if (operation === "cancel") {
      // The person's lead now may withdraw it too: a request does not stay stuck when the lead changes.
      if (request.requested_by !== actor.id) {
        const [me, person] = await Promise.all([
          tx.user.findUnique({ where: { id: actor.id }, select: { team_id: true, team_lead: true } }),
          tx.user.findUnique({ where: { id: request.user_id }, select: { team_id: true } }),
        ]);
        if (!me?.team_lead || me.team_id === null || me.team_id !== person?.team_id) {
          throw new TitleRequestError("Only the person's team lead can withdraw this request.");
        }
      }
      return tx.jobTitleRequest.delete({ where: { id: requestId }, select: { id: true } });
    }
    if (actor.role !== "SUPER_ADMIN") throw new TitleRequestError("Only administrators can approve or decline requests.");
    // A lead's new suggestion replaces the waiting one in place: decide only what the administrator saw.
    if (data.has("expected_title") && clean(data.get("expected_title")) !== request.title) {
      throw new TitleRequestError(`The suggestion changed to “${request.title}” after you opened it. Check it again before deciding.`);
    }
    const decided = { decided_by: actor.id, decided_at: new Date() };
    const told = { type: "TITLE_DECIDED", recipients: [request.requested_by], actorId: actor.id, titleRequestId: requestId } as const;
    if (operation === "decline") {
      const declined = await tx.jobTitleRequest.update({ where: { id: requestId }, data: { status: "DECLINED", ...decided }, select: { id: true } });
      await notify(tx, told);
      return declined;
    }
    if (operation !== "approve") throw new TitleRequestError("Unknown request operation.");
    // The suggested name joins the list when it is new; a title that cannot lead ends a lead role.
    const jobTitle = await findOrCreateJobTitle(tx, request.title);
    await tx.user.update({
      where: { id: request.user_id },
      data: { job_title_id: jobTitle.id, ...(jobTitle.can_lead ? {} : { team_lead: false }) },
    });
    const approved = await tx.jobTitleRequest.update({ where: { id: requestId }, data: { status: "APPROVED", ...decided }, select: { id: true } });
    await notify(tx, told);
    return approved;
  });
}
