"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { setStatus, StatusError } from "./service";

export type StatusState = { error?: string; success?: boolean };

export async function statusAction(_state: StatusState, data: FormData): Promise<StatusState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await setStatus(actor, data);
  } catch (error) {
    return { error: error instanceof StatusError ? error.message : "Your status could not be saved. Please try again." };
  }
  revalidatePath("/");
  return { success: true };
}
