import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";

export class TeamError extends Error {}

function id(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new TeamError("Invalid record ID.");
  return Number(text);
}

/**
 * Teams mirror the company structure, so only a super admin shapes them and
 * places people in them. Users see their team, but cannot change it.
 */
export async function mutateTeam(actor: Actor, data: FormData) {
  if (actor.role !== "SUPER_ADMIN") throw new TeamError("Only administrators can manage teams.");
  const operation = String(data.get("operation"));
  if (!["create", "rename", "delete", "assign", "lead", "job_title"].includes(operation)) throw new TeamError("Unknown team operation.");

  return prisma.$transaction(async (tx) => {
    if (operation === "assign") {
      const userId = id(data.get("user_id"));
      const teamId = data.get("team_id") ? id(data.get("team_id")) : null;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true } });
      if (!user?.is_active || user.role === "SUPER_ADMIN") throw new TeamError("Choose an active standard user.");
      if (teamId !== null && !await tx.team.findUnique({ where: { id: teamId }, select: { id: true } })) throw new TeamError("This team no longer exists.");
      // Leading one team says nothing about the next.
      return tx.user.update({ where: { id: userId }, data: { team_id: teamId, team_lead: false }, select: { id: true } });
    }
    if (operation === "job_title") {
      // Like an IT or HR department would: people do not set their own title.
      const userId = id(data.get("user_id"));
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true } });
      if (!user?.is_active || user.role === "SUPER_ADMIN") throw new TeamError("Choose an active standard user.");
      const title = String(data.get("job_title") ?? "").trim().replace(/\s+/g, " ");
      if (title.length > 80) throw new TeamError("A job title can be up to 80 characters.");
      return tx.user.update({ where: { id: userId }, data: { job_title: title || null }, select: { id: true } });
    }
    if (operation === "lead") {
      const userId = id(data.get("user_id"));
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, is_active: true, team_id: true } });
      if (!user?.is_active || user.role === "SUPER_ADMIN") throw new TeamError("Choose an active standard user.");
      if (user.team_id === null) throw new TeamError("Put this person in a team before making them its lead.");
      return tx.user.update({ where: { id: userId }, data: { team_lead: data.get("team_lead") === "on" }, select: { id: true } });
    }
    const teamId = operation === "create" ? null : id(data.get("team_id"));
    if (teamId !== null && !await tx.team.findUnique({ where: { id: teamId }, select: { id: true } })) throw new TeamError("This team no longer exists.");
    // Members simply become unassigned (ON DELETE SET NULL), and no longer lead anything.
    if (operation === "delete") {
      await tx.user.updateMany({ where: { team_id: teamId! }, data: { team_lead: false } });
      return tx.team.delete({ where: { id: teamId! } });
    }

    const name = String(data.get("name") ?? "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 80) throw new TeamError("Use a team name between 1 and 80 characters.");
    const name_key = name.toLowerCase();
    if (await tx.team.findFirst({ where: { name_key, ...(teamId ? { id: { not: teamId } } : {}) } })) {
      throw new TeamError("A team with this name already exists.");
    }
    return operation === "create"
      ? tx.team.create({ data: { name, name_key } })
      : tx.team.update({ where: { id: teamId! }, data: { name, name_key } });
  }, { isolationLevel: "Serializable" });
}
