import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { visibleProjects } from "@/lib/rbac";
import { defineTool } from "./define";

export type ProjectChoice = { id: number; name: string };

/**
 * The projects the user can see, by id and name only: in the same order as on the
 * Documents page, without loading every task, file and absence of each project.
 */
export async function projectList(): Promise<ProjectChoice[]> {
  const user = await requireUser();
  return prisma.project.findMany({ where: visibleProjects(user), orderBy: [{ start_date: "desc" }, { id: "asc" }], select: { id: true, name: true } });
}

export const listProjects = defineTool({
  name: "list_projects",
  description: "Lists the projects the user can access, with their ids. Shows nothing to the user.",
  status: "Counting the projects…",
  input: z.object({}),
  async run() {
    return { ok: true, value: await projectList() };
  },
});

export const askProject = defineTool({
  name: "ask_project",
  description:
    "Asks the user which project a template is for: shows a button for each of their projects and one for " +
    "all projects. Returns the projects with their ids.",
  status: "Counting the projects…",
  input: z.object({}),
  async run(_, { chosenProjectId }) {
    if (chosenProjectId !== undefined) {
      return {
        ok: false,
        error: `The user already chose: project_id ${chosenProjectId}. Do not ask again; continue with the template.`,
      };
    }
    return { ok: true, value: await projectList() };
  },
  // The buttons are the question, so wait for the user instead of letting the
  // model ask again in words.
  show(projects, emit) {
    emit({ type: "projects", projects });
    return { question: "Which project is this template for?" };
  },
});
