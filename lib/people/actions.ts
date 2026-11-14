"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { updatePerson, setJobTitleCanLead, PeopleError } from "./service";

export type PersonState = { error?: string; success?: boolean };

export async function personAction(_state: PersonState, data: FormData): Promise<PersonState> {
  const actor = await requireUser();
  try {
    await updatePerson(actor, data);
  } catch (error) {
    return { error: error instanceof PeopleError ? error.message : "These details could not be saved. Refresh and try again." };
  }
  revalidatePath("/");
  return { success: true };
}

export async function jobTitleAction(_state: PersonState, data: FormData): Promise<PersonState> {
  const actor = await requireUser();
  try {
    await setJobTitleCanLead(actor, data);
  } catch (error) {
    return { error: error instanceof PeopleError ? error.message : "This job title could not be saved. Refresh and try again." };
  }
  revalidatePath("/");
  return { success: true };
}
