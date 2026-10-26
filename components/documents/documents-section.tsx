import { getDocumentProjects, getDocumentTemplates } from "@/lib/documents/data";
import { localDay } from "@/lib/documents/engine";
import DocumentsView from "./documents-view";

export default async function DocumentsSection() {
  const [projects, templates] = await Promise.all([getDocumentProjects(), getDocumentTemplates()]);

  // Read after the queries so the date is taken at request time, not prerender time.
  const today = localDay(new Date());

  // Templates saved elsewhere (e.g. by Flawiusz) arrive on refresh; remount to pick them up.
  const templateKey = templates.map((template) => template.id).join(",");

  return <DocumentsView key={templateKey} projects={projects} initialTemplates={templates} today={today} />;
}
