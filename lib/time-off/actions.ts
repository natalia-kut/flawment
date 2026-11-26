"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { mutateTimeOff, TimeOffError } from "./service";
import { workspaceToday } from "./dates";
import { actionError } from "@/lib/action-error";

export type TimeOffState = { error?: string; success?: string };

export async function timeOffAction(_state: TimeOffState, data: FormData): Promise<TimeOffState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await mutateTimeOff(actor, data, workspaceToday());
  } catch (error) {
    // The page may be out of date (someone else changed or removed this): show what is saved now.
    revalidatePath("/");
    return { error: actionError(error, TimeOffError, "Your time off could not be saved. Please try again.") };
  }
  revalidatePath("/");
  return { success: data.get("operation") === "delete" ? "Time off removed." : "Time off added." };
}
