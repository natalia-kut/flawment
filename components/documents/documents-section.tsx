import { getDocumentProjects, getDocumentTemplates } from "@/lib/documents/data";
import { workspaceToday } from "@/lib/time-off/dates";
import DocumentsView from "./documents-view";

export default async function DocumentsSection() {
  const [projects, templates] = await Promise.all([getDocumentProjects(), getDocumentTemplates()]);

  // Read after the queries so the date is taken at request time, not prerender time.
  const today = workspaceToday();

  // Templates saved elsewhere (another tab, Flawiusz) arrive on refresh; DocumentsView takes them in
  // itself rather than being remounted, which would close a template being built.
  return <DocumentsView projects={projects} initialTemplates={templates} today={today} />;
}
