import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/rbac";
import { absenceSelect, availability, canSeeAbsenceReason, toRanges, type Availability } from "@/lib/time-off/availability";
import { daysUntilBirthday, formatBirthday, nextAnniversary, workspaceDay } from "@/lib/time-off/dates";
import type { AbsenceType } from "@/src/generated/prisma/enums";
import { activeStatus, statusSelect, type Status } from "@/lib/status/status";

const personSelect = (today: string) => ({
  id: true, first_name: true, last_name: true, email: true, description: true,
  photo_updated_at: true, birth_date: true, team_id: true, team_lead: true,
  job_title: true, pronouns: true, phone: true, location: true, working_hours: true, skills: true,
  absences: absenceSelect(today), ...statusSelect, created_at: true,
}) as const;

type PersonRow = {
  id: number; first_name: string; last_name: string; email: string; description: string | null;
  photo_updated_at: Date | null; birth_date: Date | null; team_id: number | null; team_lead: boolean;
  job_title: string | null; pronouns: string | null; phone: string | null; location: string | null;
  working_hours: string | null; skills: string[];
  absences: { start_date: Date; end_date: Date; type: AbsenceType }[];
  status_emoji: string | null; status_text: string | null; status_expires_at: Date | null;
  created_at: Date;
};

export type Viewer = { id: number; role: string; team_id: number | null; team_lead: boolean };

export type TeamPerson = {
  id: number; first_name: string; last_name: string; email: string; description: string | null;
  photoVersion: string | null; teamId: number | null; teamLead: boolean;
  jobTitle: string | null; pronouns: string | null; phone: string | null; location: string | null;
  workingHours: string | null; skills: string[];
  status: Status | null;
  /** The next work anniversary (from account creation), once a first one is due. */
  anniversary: { years: number; inDays: number } | null;
  /** Carries `reasons` only when the viewer may know them. */
  availability: Availability;
  /** Day and month only: the year never leaves the server. */
  birthday: { label: string; inDays: number } | null;
};

export function toPerson(row: PersonRow, viewer: Viewer, today: string): TeamPerson {
  const birth = row.birth_date?.toISOString().slice(0, 10);
  return {
    id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email, description: row.description,
    photoVersion: row.photo_updated_at?.toISOString() ?? null, teamId: row.team_id, teamLead: row.team_lead,
    jobTitle: row.job_title, pronouns: row.pronouns, phone: row.phone, location: row.location,
    workingHours: row.working_hours, skills: row.skills, status: activeStatus(row),
    anniversary: nextAnniversary(workspaceDay(row.created_at), today),
    availability: availability(toRanges(row.absences, canSeeAbsenceReason(viewer, row)), today),
    birthday: birth ? { label: formatBirthday(birth), inDays: daysUntilBirthday(birth, today) } : null,
  };
}

export async function getViewer(actor: Actor): Promise<Viewer> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { team_id: true, team_lead: true } });
  return { id: actor.id, role: actor.role, ...user };
}

/**
 * A super admin sees every team and every standard user (to place them);
 * anyone else sees only their own team.
 */
export async function getTeamsOverview(actor: Actor, today: string) {
  const viewer = await getViewer(actor);
  const byName = [{ first_name: "asc" as const }, { last_name: "asc" as const }];
  if (actor.role === "SUPER_ADMIN") {
    const [teams, people] = await Promise.all([
      prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { is_active: true, role: "USER" }, orderBy: byName, select: personSelect(today) }),
    ]);
    const all = people.map((row) => toPerson(row, viewer, today));
    return {
      canManage: true as const, leadsMyTeam: false,
      teams: teams.map((team) => ({ ...team, members: all.filter((p) => p.teamId === team.id) })),
      unassigned: all.filter((p) => p.teamId === null),
      people: all,
    };
  }
  const team = viewer.team_id === null ? null : await prisma.team.findUnique({ where: { id: viewer.team_id }, select: { id: true, name: true } });
  if (!team) return { canManage: false as const, leadsMyTeam: false, teams: [], unassigned: [], people: [] };
  const members = await prisma.user.findMany({
    where: { is_active: true, role: "USER", team_id: team.id }, orderBy: [{ team_lead: "desc" }, ...byName], select: personSelect(today),
  });
  const people = members.map((row) => toPerson(row, viewer, today));
  return { canManage: false as const, leadsMyTeam: viewer.team_lead, teams: [{ ...team, members: people }], unassigned: [], people };
}

export type TeamsOverview = Awaited<ReturnType<typeof getTeamsOverview>>;
