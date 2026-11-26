import { getDocumentProjects, getDocumentTemplates } from "@/lib/documents/data";
import { workspaceToday } from "@/lib/time-off/dates";
import DocumentsView from "./documents-view";

export default async function DocumentsSection() {
  const [projects, templates] = await Promise.all([getDocumentProjects(), getDocumentTemplates()]);

  // Read after the queries so the date is taken at request time, not prerender time.
  const today = workspaceToday();

  // Templates saved elsewhere (another tab, Flawiusz) arrive on refresh; remount to pick them up.
  // The version is part of the key, so changed content shows too, not only added or removed templates.
  const templateKey = templates.map((template) => template.id + "@" + (template.version ?? "")).join(",");

  return <DocumentsView key={templateKey} projects={projects} initialTemplates={templates} today={today} />;
}
