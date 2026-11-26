"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { mutateStage, StageError } from "./service";

export type StageState = { error?: string; success?: boolean };
export async function stageAction(_state: StageState, data: FormData): Promise<StageState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await mutateStage(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error instanceof StageError ? error.message : "Could not save the stage. Refresh and try again." };
  }
}
