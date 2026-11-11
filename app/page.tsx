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

async function Workspace() {
  const user = await requireUser();
  const projects = await getWorkspaceProjects();
  // Read on the server, so a collapsed sidebar is already narrow on first paint.
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <AppShell
      user={user}
      projectCount={projects.length}
      sidebarCollapsed={sidebarCollapsed}
      tasks={<TasksOverview projects={projects} currentUserId={user.id} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} />}
      projects={<ProjectsView projects={projects} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} />}
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
