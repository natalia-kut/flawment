"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { mutateProject, ProjectError } from "./service";

export type ProjectState = { error?: string; success?: string };
export async function projectAction(_state: ProjectState, data: FormData): Promise<ProjectState> {
  const actor = await requireUser();
  try {
    await mutateProject(actor, data);
  } catch (error) {
    return { error: error instanceof ProjectError ? error.message : "The change could not be saved. Refresh and try again." };
  }
  revalidatePath("/");
  return { success: "Changes saved." };
}
