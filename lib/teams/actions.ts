"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { mutateTeam, TeamError } from "./service";
import { actionError } from "@/lib/action-error";

export type TeamState = { error?: string; success?: string };

export async function teamAction(_state: TeamState, data: FormData): Promise<TeamState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await mutateTeam(actor, data);
  } catch (error) {
    // The page may be out of date (someone else changed or removed this): show what is saved now.
    revalidatePath("/");
    return { error: actionError(error, TeamError, "The team could not be saved. Refresh and try again.") };
  }
  revalidatePath("/");
  return { success: "Teams updated." };
}
