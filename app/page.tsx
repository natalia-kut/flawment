import { Suspense } from "react";
import AppShell from "./app-shell";
import DocumentsSection from "./documents-section";
import ProjectsSection from "./projects-section";

export default function Home() {
  return (
    <AppShell
      projects={
        <Suspense fallback={<p>Loading projects...</p>}>
          <ProjectsSection />
        </Suspense>
      }
      documents={
        <Suspense fallback={<p>Loading project data...</p>}>
          <DocumentsSection />
        </Suspense>
      }
    />
  );
}