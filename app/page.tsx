import { Suspense } from "react";
import AppShell from "./app-shell";
import DocumentsSection from "./documents-section";

export default function Home() {
  return (
    <AppShell
      documents={
        <Suspense fallback={<p className="documents-loading">Loading project data…</p>}>
          <DocumentsSection />
        </Suspense>
      }
    />
  );
}
