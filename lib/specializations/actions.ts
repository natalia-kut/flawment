"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { mutateSpecialization, SpecializationError } from "./service";

export async function specializationAction(_state: { error?: string; success?: string }, data: FormData): Promise<{ error?: string; success?: string }> {
  const actor = await requireUser();
  try {
    await mutateSpecialization(actor, data);
  } catch (error) {
    return { error: error instanceof SpecializationError ? error.message : "The specialization could not be saved. Refresh and try again." };
  }
  revalidatePath("/");
  return { success: "Specializations updated." };
}
