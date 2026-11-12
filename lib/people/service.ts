import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";
import type { Prisma } from "@/src/generated/prisma/client";

export class PeopleError extends Error {}

const clean = (value: FormDataEntryValue | null) => String(value ?? "").trim().replace(/\s+/g, " ");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalId(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!text) return null;
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new PeopleError("Invalid record ID.");
  return Number(text);
}

/** Finds a job title by name (ignoring case and spacing), or adds it to the list. */
async function findOrCreateJobTitle(tx: Prisma.TransactionClient, rawName: string, canLead: boolean) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new PeopleError("Use a job title between 1 and 80 characters.");
  const name_key = name.toLowerCase();
  return await tx.jobTitle.findUnique({ where: { name_key } }) ?? tx.jobTitle.create({ data: { name, name_key, can_lead: canLead } });
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
  if (!first_name || !last_name || first_name.length > 60 || last_name.length > 60) throw new PeopleError("Enter a first and last name (up to 60 characters each).");
  if (!EMAIL.test(email) || email.length > 254) throw new PeopleError("Enter a valid email address.");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true } });
    if (!user?.is_active) throw new PeopleError("This person no longer has an active account.");
    if (await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: userId } }, select: { id: true } })) {
      throw new PeopleError("Another account already uses this email.");
    }

    // "new" adds a title to the list; otherwise an existing one (or none).
    const titleChoice = String(data.get("job_title_id") ?? "");
    const jobTitle = titleChoice === "new"
      ? await findOrCreateJobTitle(tx, String(data.get("new_job_title") ?? ""), data.get("new_job_title_can_lead") === "on")
      : titleChoice ? await tx.jobTitle.findUnique({ where: { id: optionalId(titleChoice)! } }) : null;
    if (titleChoice && !jobTitle) throw new PeopleError("This job title no longer exists.");

    // Super admins run the workspace rather than belong to a team.
    const teamId = user.role === "SUPER_ADMIN" ? null : optionalId(data.get("team_id"));
    if (teamId !== null && !await tx.team.findUnique({ where: { id: teamId }, select: { id: true } })) throw new PeopleError("This team no longer exists.");
    const wantsLead = data.get("team_lead") === "on";
    if (wantsLead && teamId === null) throw new PeopleError("Put this person in a team before making them its lead.");
    if (wantsLead && !jobTitle?.can_lead) throw new PeopleError("Only people with a managerial job title can lead a team.");

    return tx.user.update({
      where: { id: userId },
      data: { first_name, last_name, email, job_title_id: jobTitle?.id ?? null, team_id: teamId, team_lead: wantsLead },
      select: { id: true },
    });
  }, { isolationLevel: "Serializable" });
}
