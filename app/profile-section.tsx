import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { absenceSelect, availability, toRanges } from "@/lib/time-off/availability";
import { workspaceToday } from "@/lib/time-off/dates";
import { activeStatus, statusSelect } from "@/lib/status/status";
import ProfileView from "./profile-view";

const person = { id: true, first_name: true, last_name: true, photo_updated_at: true } as const;
const plain = (p: { id: number; first_name: string; last_name: string; photo_updated_at: Date | null }) =>
  ({ id: p.id, first_name: p.first_name, last_name: p.last_name, photoVersion: p.photo_updated_at?.toISOString() ?? null });

export default async function ProfileSection() {
  const actor = await requireUser();
  const today = workspaceToday();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: {
    id: true, first_name: true, last_name: true, username: true, email: true, role: true,
    birth_date: true, team_lead: true, job_title: { select: { name: true } }, pronouns: true, phone: true, location: true, working_hours: true, skills: true,
    team: { select: { id: true, name: true, members: { where: { is_active: true }, select: { ...person, team_lead: true }, orderBy: { first_name: "asc" } } } },
    absences: absenceSelect(today), ...statusSelect,
  } });
  const nextTimeOff = await prisma.absence.findFirst({
    where: { user_id: actor.id, end_date: { gte: new Date(today) } }, orderBy: { start_date: "asc" },
    select: { type: true, start_date: true, end_date: true },
  });
  const { absences, birth_date, team, team_lead, job_title, working_hours, status_emoji, status_text, status_expires_at, ...rest } = user;
  return <ProfileView today={today} user={{
    ...rest, photoVersion: actor.photoVersion, teamLead: team_lead,
    status: activeStatus({ status_emoji, status_text, status_expires_at }),
    jobTitle: job_title?.name ?? "", workingHours: working_hours ?? "",
    pronouns: rest.pronouns ?? "", phone: rest.phone ?? "", location: rest.location ?? "",
    birthDate: birth_date?.toISOString().slice(0, 10) ?? "",
    availability: availability(toRanges(absences, true), today),
    nextTimeOff: nextTimeOff && { type: nextTimeOff.type, start: nextTimeOff.start_date.toISOString().slice(0, 10), end: nextTimeOff.end_date.toISOString().slice(0, 10) },
    team: team && {
      name: team.name,
      // "Reports to": the team's leads other than you.
      leads: team.members.filter((m) => m.team_lead && m.id !== actor.id).map(plain),
      members: team.members.map(plain),
    },
  }} />;
}
