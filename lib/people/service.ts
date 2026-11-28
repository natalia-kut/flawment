import type { Actor } from "@/lib/rbac";
import type { Prisma } from "@/src/generated/prisma/client";
import { isManagerialTitle } from "./job-titles";
import { serializable } from "@/lib/transaction";
import { isValidName, NAME_RULE } from "@/lib/auth/names";
import { cleanLine, hasLetterOrDigit } from "@/lib/text";

export class PeopleError extends Error {}

const clean = (value: FormDataEntryValue | null) => cleanLine(String(value ?? ""));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalId(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!text) return null;
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new PeopleError("Invalid record ID.");
  return Number(text);
}

/** Finds a job title by name (ignoring case and spacing), or adds it to the list; its name says whether it is managerial. */
export async function findOrCreateJobTitle(tx: Prisma.TransactionClient, rawName: string) {
  const name = cleanLine(rawName);
  if (!name || name.length > 80) throw new PeopleError("Use a job title between 1 and 80 characters.");
  if (!hasLetterOrDigit(name)) throw new PeopleError("Use a job title with at least one letter or digit.");
  const name_key = name.toLowerCase();
  return await tx.jobTitle.findUnique({ where: { name_key } })
    ?? tx.jobTitle.create({ data: { name, name_key, can_lead: isManagerialTitle(name) } });
}

/**
 * A super admin edits someone's account details: name, email, job title,
 * team and whether they lead it. Like an IT or HR department would.
 */
export async function updatePerson(actor: Actor, data: FormData) {
  if (actor.role !== "SUPER_ADMIN") throw new PeopleError("Only administrators can edit people.");
  const userId = optionalId(data.get("user_id"));
  if (userId === null) throw new PeopleError("Choose a person.");
  const first_name = clean(data.get("first_name")), last_name = clean(data.get("last_name"));
  const email = clean(data.get("email")).toLowerCase();
  // The same rule as registration, so an account made there can always be edited here.
  if (!first_name || !last_name || first_name.length > 80 || last_name.length > 80) throw new PeopleError("Enter a first and last name (up to 80 characters each).");
  if (!isValidName(first_name) || !isValidName(last_name)) throw new PeopleError(NAME_RULE);
  if (!EMAIL.test(email) || email.length > 254) throw new PeopleError("Enter a valid email address.");

  return serializable(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true, team_id: true } });
    if (!user?.is_active) throw new PeopleError("This person no longer has an active account.");
    if (await tx.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } })) {
      throw new PeopleError("Another account already uses this email.");
    }

    // "new" adds a title to the list; otherwise an existing one (or none).
    const titleChoice = String(data.get("job_title_id") ?? "");
    const jobTitle = titleChoice === "new"
      ? await findOrCreateJobTitle(tx, String(data.get("new_job_title") ?? ""))
      : titleChoice ? await tx.jobTitle.findUnique({ where: { id: optionalId(titleChoice)! } }) : null;
    if (titleChoice && !jobTitle) throw new PeopleError("This job title no longer exists.");

    // Super admins run the workspace rather than belong to a team.
    const teamId = user.role === "SUPER_ADMIN" ? null : optionalId(data.get("team_id"));
    if (teamId !== null && !await tx.team.findUnique({ where: { id: teamId }, select: { id: true } })) throw new PeopleError("This team no longer exists.");
    const wantsLead = data.get("team_lead") === "on";
    if (wantsLead && teamId === null) throw new PeopleError("Put this person in a team before making them its lead.");
    if (wantsLead && !jobTitle?.can_lead) throw new PeopleError("Only people with a managerial job title can lead a team.");

    // A team has one lead: a new one takes over from whoever led it.
    if (wantsLead) await tx.user.updateMany({ where: { team_id: teamId!, team_lead: true, id: { not: userId } }, data: { team_lead: false } });
    // A waiting job title suggestion came from the old team's lead: it ends with the move.
    if (teamId !== user.team_id) await tx.jobTitleRequest.deleteMany({ where: { user_id: userId, status: "PENDING" } });
    return tx.user.update({
      where: { id: userId },
      data: { first_name, last_name, email, job_title_id: jobTitle?.id ?? null, team_id: teamId, team_lead: wantsLead },
      select: { id: true },
    });
  });
}

/**
 * A super admin corrects whether a job title is managerial, when its name guessed wrong
 * (a "Scrum Master" who leads, an "Account manager" who does not). Taking it away also
 * ends the team lead role of everyone with this title, so no team keeps a lead who may not lead.
 */
export async function setJobTitleCanLead(actor: Actor, data: FormData) {
  if (actor.role !== "SUPER_ADMIN") throw new PeopleError("Only administrators can change job titles.");
  const titleId = optionalId(data.get("job_title_id"));
  if (titleId === null) throw new PeopleError("Choose a job title.");
  const canLead = data.get("can_lead") === "on";
  return serializable(async (tx) => {
    if (!await tx.jobTitle.findUnique({ where: { id: titleId }, select: { id: true } })) throw new PeopleError("This job title no longer exists.");
    if (!canLead) await tx.user.updateMany({ where: { job_title_id: titleId, team_lead: true }, data: { team_lead: false } });
    return tx.jobTitle.update({ where: { id: titleId }, data: { can_lead: canLead }, select: { id: true } });
  });
}
