import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { visibleProjects, type Actor } from "@/lib/rbac";
import { defineTool } from "./define";

export type ProjectChoice = { id: number; name: string };

/**
 * The projects the user can see, by id and name only: in the same order as on the
 * Documents page, without loading every task, file and absence of each project.
 */
export async function projectList(actor: Actor): Promise<ProjectChoice[]> {
  return prisma.project.findMany({ where: visibleProjects(actor), orderBy: [{ start_date: "desc" }, { id: "asc" }], select: { id: true, name: true } });
}

export const listProjects = defineTool({
  name: "list_projects",
  description: "Lists the projects the user can access, with their ids. Shows nothing to the user.",
  status: "Counting the projects…",
  input: z.object({}),
  async run(_, { actor }) {
    if (!actor) return { ok: false, error: "Sign in first." };
    return { ok: true, value: await projectList(actor) };
  },
});

export const askProject = defineTool({
  name: "ask_project",
  description:
    "Asks the user which project a template is for: shows a button for each of their projects and one for " +
    "all projects. Returns the projects with their ids.",
  status: "Counting the projects…",
  input: z.object({}),
  async run(_, { actor, chosenProjectId }) {
    if (!actor) return { ok: false, error: "Sign in first." };
    if (chosenProjectId !== undefined) {
      return {
        ok: false,
        error: `The user already chose: project_id ${chosenProjectId}. Do not ask again; continue with the template.`,
      };
    }
    return { ok: true, value: await projectList(actor) };
  },
  // The buttons are the question, so wait for the user instead of letting the
  // model ask again in words.
  show(projects, emit) {
    emit({ type: "projects", projects });
    return { question: "Which project is this template for?" };
  },
});
