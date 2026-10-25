import { Suspense } from "react";
import AppShell from "./app-shell";
import DocumentsSection from "./documents-section";
import ProjectsView from "./projects-view";

export default function Home() {
  return (
    <AppShell
      projects={<ProjectsView />}
      documents={
        <Suspense fallback={<p className="documents-loading">Loading project data…</p>}>
          <DocumentsSection />
        </Suspense>
      }
    />
  );
}