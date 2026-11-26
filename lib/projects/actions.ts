"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { mutateProject, ProjectError } from "./service";

export type ProjectState = { error?: string; success?: string; projectId?: number };
export async function projectAction(_state: ProjectState, data: FormData): Promise<ProjectState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    const result = await mutateProject(actor, data);
    revalidatePath("/");
    return { success: "Changes saved.", projectId: data.get("operation") === "create" ? result.id : undefined };
  } catch (error) {
    // The page may be out of date (a conflict, a member already removed): show what is saved now.
    revalidatePath("/");
    return { error: error instanceof ProjectError ? error.message : "The change could not be saved. Refresh and try again." };
  }
}
