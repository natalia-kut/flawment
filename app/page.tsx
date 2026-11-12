import { Suspense } from "react";
import { cookies } from "next/headers";
import AppShell from "./app-shell";
import { SIDEBAR_COOKIE } from "@/lib/ui/sidebar";
import DocumentsSection from "@/components/documents/documents-section";
import DocumentsSkeleton from "@/components/documents/documents-skeleton";
import { requireUser } from "@/lib/auth/session";
import { getWorkspaceProjects } from "@/lib/projects/data";
import ProjectsView from "./projects-view";
import TasksOverview from "./tasks-overview";
import ProfileSection from "./profile-section";
import TeamSection from "./team-section";
import TimeOffSection from "./time-off-section";
import PeopleSection from "./people-section";
import { prisma } from "@/lib/prisma";
import { availability, relevantAbsences, toRanges } from "@/lib/time-off/availability";
import { todaysCelebrations, workspaceDay, workspaceToday } from "@/lib/time-off/dates";
import { activeStatus, statusSelect } from "@/lib/status/status";
import { getCalendarTimeOff } from "@/lib/time-off/calendar";
import { getTeamsOverview } from "@/lib/teams/data";

async function Workspace() {
  const user = await requireUser();
  const projects = await getWorkspaceProjects();
  // Read on the server, so a collapsed sidebar is already narrow on first paint.
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const today = workspaceToday();
  // The account button shows when you are marked as away.
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { ...statusSelect, birth_date: true, created_at: true } });
  const celebrations = todaysCelebrations(user.first_name, me.birth_date?.toISOString().slice(0, 10) ?? null, workspaceDay(me.created_at), today);
  const timeOff = await getCalendarTimeOff(user, today);
  // Loaded once for both the Team page and the dashboard's "Your team".
  const teams = await getTeamsOverview(user, today);
  const own = teams.teams.find((team) => team.id === teams.myTeamId);
  const myTeam = own ? { name: own.name, members: own.members } : null;
  const myAbsences = await prisma.absence.findMany({ where: { user_id: user.id, ...relevantAbsences(today) }, select: { start_date: true, end_date: true, type: true } });
  return (
    <AppShell
      user={{ ...user, celebrations, status: activeStatus(me), availability: availability(toRanges(myAbsences, true), today) }}
      profile={<ProfileSection />}
      team={<TeamSection overview={teams} />}
      timeOff={<TimeOffSection />}
      people={<PeopleSection />}
      workspace={{ projects, userId: user.id, today, timeOff, myTeam }}
      sidebarCollapsed={sidebarCollapsed}
      tasks={<TasksOverview projects={projects} currentUserId={user.id} today={today} />}
      projects={<ProjectsView projects={projects} today={today} />}
      documents={
        <Suspense fallback={<DocumentsSkeleton />}>
          <DocumentsSection />
        </Suspense>
      }
    />
  );
}

export default function Home() {
  return <Suspense fallback={<p className="documents-loading">Loading workspace…</p>}><Workspace /></Suspense>;
}
