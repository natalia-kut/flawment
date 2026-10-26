import { getDocumentProjects, getDocumentTemplates } from "@/lib/documents/data";
import DocumentsView from "./documents-view";

function localDay(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export default async function DocumentsSection() {
  const [projects, templates] = await Promise.all([getDocumentProjects(), getDocumentTemplates()]);

  // Read after the queries so the date is taken at request time, not prerender time.
  const today = localDay(new Date());

  return <DocumentsView projects={projects} initialTemplates={templates} today={today} />;
}
