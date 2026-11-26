"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { updateProfile, updateProfileField, ProfileError } from "./service";
import { actionError } from "@/lib/action-error";

export async function profileAction(_state: { error?: string; success?: string }, data: FormData): Promise<{ error?: string; success?: string }> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await updateProfile(actor, data);
  } catch (error) {
    return { error: actionError(error, ProfileError, "Your profile could not be saved. Please try again.") };
  }
  revalidatePath("/");
  return { success: "Your profile has been updated." };
}

export async function profileFieldAction(_state: { error?: string; saved?: string }, data: FormData): Promise<{ error?: string; saved?: string }> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  let value = "";
  try {
    // Read inside try: a call without form data is an error to report, not a crash.
    value = String(data.get("value") ?? "");
    await updateProfileField(actor, String(data.get("field") ?? ""), value);
  } catch (error) {
    return { error: actionError(error, ProfileError, "This detail could not be saved. Please try again.") };
  }
  revalidatePath("/");
  return { saved: value };
}
