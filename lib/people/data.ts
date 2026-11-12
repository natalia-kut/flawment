import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";

/** Everyone's account details for the super admin's People page; null for anyone else. */
export async function getPeopleDirectory(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN") return null;
  const [people, jobTitles, teams] = await Promise.all([
    prisma.user.findMany({
      where: { is_active: true },
      orderBy: [{ role: "desc" }, { first_name: "asc" }, { last_name: "asc" }],
      select: {
        id: true, username: true, email: true, first_name: true, last_name: true, role: true, photo_updated_at: true,
        job_title_id: true, team_id: true, team_lead: true, created_at: true,
      },
    }),
    prisma.jobTitle.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, can_lead: true } }),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    jobTitles, teams,
    people: people.map(({ photo_updated_at, created_at, ...person }) => ({
      ...person, photoVersion: photo_updated_at?.toISOString() ?? null, joined: created_at.toISOString(),
    })),
  };
}

export type PeopleDirectory = NonNullable<Awaited<ReturnType<typeof getPeopleDirectory>>>;
