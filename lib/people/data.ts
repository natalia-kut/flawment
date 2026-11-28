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

export type AdministratorContact = { id: number; name: string; email: string };

/**
 * Who to contact about an account, a job title or a team: the active administrators,
 * by name and email only. They stay out of the directory, teams and projects as before.
 */
export async function getAdministrators(): Promise<AdministratorContact[]> {
  const rows = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN", is_active: true },
    select: { id: true, first_name: true, last_name: true, email: true },
    orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
  });
  return rows.map((row) => ({ id: row.id, name: `${row.first_name} ${row.last_name}`.trim(), email: row.email }));
}
