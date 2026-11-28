import type { Actor } from "@/lib/rbac";
import { serializable } from "@/lib/transaction";
import { cleanLine, hasLetterOrDigit } from "@/lib/text";

export class TeamError extends Error {}

function id(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new TeamError("Invalid record ID.");
  return Number(text);
}

/**
 * The team the page showed the person in (`expected_team_id`, empty for none). A page
 * opened earlier must not make someone the lead of, or take them out of, a team they
 * have since left.
 */
function checkShownTeam(data: FormData, teamId: number | null) {
  if (!data.has("expected_team_id")) return;
  const value = String(data.get("expected_team_id") ?? "");
  if ((value === "" ? null : id(value)) !== teamId) {
    throw new TeamError("This person moved to another team in the meantime. The page now shows where they are.");
  }
}

/**
 * Teams mirror the company structure, so only a super admin shapes them and
 * places people in them. Users see their team, but cannot change it.
 */
export async function mutateTeam(actor: Actor, data: FormData) {
  if (actor.role !== "SUPER_ADMIN") throw new TeamError("Only administrators can manage teams.");
  const operation = String(data.get("operation"));
  if (!["create", "rename", "delete", "assign", "lead"].includes(operation)) throw new TeamError("Unknown team operation.");

  return serializable(async (tx) => {
    if (operation === "assign") {
      const userId = id(data.get("user_id"));
      const teamId = data.get("team_id") ? id(data.get("team_id")) : null;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true, team_id: true } });
      if (!user?.is_active || user.role === "SUPER_ADMIN") throw new TeamError("Choose an active standard user.");
      checkShownTeam(data, user.team_id);
      if (teamId !== null && !await tx.team.findUnique({ where: { id: teamId }, select: { id: true } })) throw new TeamError("This team no longer exists.");
      // Leading one team says nothing about the next, and a waiting job title suggestion
      // came from the old team's lead: both end with the move.
      if (teamId !== user.team_id) await tx.jobTitleRequest.deleteMany({ where: { user_id: userId, status: "PENDING" } });
      return tx.user.update({ where: { id: userId }, data: { team_id: teamId, team_lead: false }, select: { id: true } });
    }
    if (operation === "lead") {
      const userId = id(data.get("user_id"));
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true, team_id: true, job_title: { select: { can_lead: true } } } });
      if (!user?.is_active || user.role === "SUPER_ADMIN") throw new TeamError("Choose an active standard user.");
      checkShownTeam(data, user.team_id);
      if (user.team_id === null) throw new TeamError("Put this person in a team before making them its lead.");
      const lead = data.get("team_lead") === "on";
      // Leading a team is for managers: the job title decides, not a checkbox alone.
      if (lead && !user.job_title?.can_lead) throw new TeamError("Only people with a managerial job title can lead a team.");
      // A team has one lead: a new one takes over from whoever led it.
      if (lead) await tx.user.updateMany({ where: { team_id: user.team_id, team_lead: true, id: { not: userId } }, data: { team_lead: false } });
      return tx.user.update({ where: { id: userId }, data: { team_lead: lead }, select: { id: true } });
    }
    const teamId = operation === "create" ? null : id(data.get("team_id"));
    if (teamId !== null && !await tx.team.findUnique({ where: { id: teamId }, select: { id: true } })) throw new TeamError("This team no longer exists.");
    // Members simply become unassigned (ON DELETE SET NULL), and no longer lead anything.
    if (operation === "delete") {
      await tx.user.updateMany({ where: { team_id: teamId! }, data: { team_lead: false } });
      return tx.team.delete({ where: { id: teamId! } });
    }

    // Lookalikes are one name: invisible characters go, and accents are composed one way.
    const name = cleanLine(String(data.get("name") ?? ""));
    if (!name || name.length > 80) throw new TeamError("Use a team name between 1 and 80 characters.");
    if (!hasLetterOrDigit(name)) throw new TeamError("Use a team name with at least one letter or digit.");
    const name_key = name.toLowerCase();
    if (await tx.team.findFirst({ where: { name_key, ...(teamId ? { id: { not: teamId } } : {}) } })) {
      throw new TeamError("A team with this name already exists.");
    }
    return operation === "create"
      ? tx.team.create({ data: { name, name_key } })
      : tx.team.update({ where: { id: teamId! }, data: { name, name_key } });
  });
}
