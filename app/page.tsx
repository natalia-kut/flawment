import { Suspense } from "react";
import AppShell from "./app-shell";
import DocumentsSection from "@/components/documents/documents-section";
import { requireUser } from "@/lib/auth/session";
import { getWorkspaceProjects } from "@/lib/projects/data";
import ProjectsView from "./projects-view";
import TasksOverview from "./tasks-overview";

async function Workspace() {
  const user = await requireUser();
  const projects = await getWorkspaceProjects();
  return (
    <AppShell
      user={user}
      projectCount={projects.length}
      tasks={<TasksOverview projects={projects} currentUserId={user.id} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} />}
      projects={<ProjectsView projects={projects} today={new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} />}
      documents={
        <Suspense fallback={<p className="documents-loading">Loading project data…</p>}>
          <DocumentsSection />
        </Suspense>
      }
    />
  );
}

export default function Home() {
  return <Suspense fallback={<p className="documents-loading">Loading workspace…</p>}><Workspace /></Suspense>;
}
