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
import TaskSection from "./task-section";
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
import { getLeadTitleRequests, getPendingTitleRequests } from "@/lib/job-title-requests/data";

async function Workspace({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const taskId = params.task;
  // Only the view on screen is rendered (as AppShell picks it): a project or task link lives under
  // Projects or Tasks. Rendering every view for every page made each one about 1 MB for a super admin.
  const view = typeof params.view === "string" ? params.view : "";
  const section = params.project !== undefined ? "projects" : taskId !== undefined ? "tasks" : view;
  // This address, so signing in returns here (a shared task or view link).
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) for (const one of [value ?? []].flat()) query.append(key, one);
  const user = await requireUser(query.size ? "/?" + query : "/");
  const projects = await getWorkspaceProjects();
  // Read on the server, so a collapsed sidebar is already narrow on first paint.
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const today = workspaceToday();
  // The account button shows when you are marked as away.
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { ...statusSelect, birth_date: true, created_at: true, job_title: { select: { can_lead: true } } } });
  // Managers (a managerial job title) and super admins start projects.
  const canCreateProjects = user.role === "SUPER_ADMIN" || !!me.job_title?.can_lead;
  const celebrations = todaysCelebrations(user.first_name, me.birth_date?.toISOString().slice(0, 10) ?? null, workspaceDay(me.created_at), today);
  const timeOff = await getCalendarTimeOff(user, today);
  // Loaded once for both the Team page and the dashboard's "Your team".
  const teams = await getTeamsOverview(user, today);
  const own = teams.teams.find((team) => team.id === teams.myTeamId);
  const myTeam = own ? { id: own.id, name: own.name, members: own.members } : null;
  // Job title requests: a super admin decides them, a team lead follows their own.
  const [pendingRequests, leadRequests] = await Promise.all([getPendingTitleRequests(user), getLeadTitleRequests(user)]);
  const admin = user.role === "SUPER_ADMIN" ? { requests: pendingRequests, people: teams.people, teams: teams.teams } : null;
  const myAbsences = await prisma.absence.findMany({ where: { user_id: user.id, ...relevantAbsences(today) }, select: { start_date: true, end_date: true, type: true } });
  return (
    <AppShell
      user={{ ...user, celebrations, status: activeStatus(me), availability: availability(toRanges(myAbsences, true), today) }}
      profile={section === "profile" ? <ProfileSection /> : null}
      team={section === "team" ? <TeamSection overview={teams} titleRequests={leadRequests.byPerson} /> : null}
      timeOff={section === "time-off" ? <TimeOffSection /> : null}
      people={section === "people" ? <PeopleSection /> : null}
      directory={{ people: teams.people, teams: teams.teams.map(({ id, name }) => ({ id, name })) }}
      workspace={{ projects, userId: user.id, today, timeOff, myTeam, admin }}
      sidebarCollapsed={sidebarCollapsed}
      tasks={section === "tasks" && taskId === undefined ? <TasksOverview projects={projects} currentUserId={user.id} today={today} /> : null}
      task={taskId !== undefined ? <TaskSection taskId={String(taskId)} projects={projects} user={user} today={today} /> : null}
      projects={section === "projects" ? <ProjectsView projects={projects} today={today} canCreateProjects={canCreateProjects} /> : null}
      documents={section === "documents" ? (
        <Suspense fallback={<DocumentsSkeleton />}>
          <DocumentsSection />
        </Suspense>
      ) : null}
    />
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return <Suspense fallback={<p className="documents-loading">Loading workspace…</p>}><Workspace searchParams={searchParams} /></Suspense>;
}
