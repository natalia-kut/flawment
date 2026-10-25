import { Suspense } from "react";
import AppShell from "./app-shell";
import DocumentsSection from "./documents-section";
import { requireUser } from "@/lib/auth/session";
import { getWorkspaceProjects } from "@/lib/projects/data";
import ProjectsView from "./projects-view";

async function Workspace() {
  const user = await requireUser();
  const projects = await getWorkspaceProjects();
  return (
    <AppShell
      user={user}
      projectCount={projects.length}
      projects={<ProjectsView projects={projects} />}
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
