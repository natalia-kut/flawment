"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { updatePerson, setJobTitleCanLead, PeopleError } from "./service";
import { actionError } from "@/lib/action-error";

export type PersonState = { error?: string; success?: boolean };

export async function personAction(_state: PersonState, data: FormData): Promise<PersonState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await updatePerson(actor, data);
  } catch (error) {
    // The page may be out of date (someone else changed or removed this): show what is saved now.
    revalidatePath("/");
    return { error: actionError(error, PeopleError, "These details could not be saved. Refresh and try again.") };
  }
  revalidatePath("/");
  return { success: true };
}

export async function jobTitleAction(_state: PersonState, data: FormData): Promise<PersonState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await setJobTitleCanLead(actor, data);
  } catch (error) {
    // The page may be out of date (someone else changed or removed this): show what is saved now.
    revalidatePath("/");
    return { error: actionError(error, PeopleError, "This job title could not be saved. Refresh and try again.") };
  }
  revalidatePath("/");
  return { success: true };
}
