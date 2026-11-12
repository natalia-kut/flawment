"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { updateProfile, updateProfileField, ProfileError } from "./service";

export async function profileAction(_state: { error?: string; success?: string }, data: FormData): Promise<{ error?: string; success?: string }> {
  const actor = await requireUser();
  try {
    await updateProfile(actor, data);
  } catch (error) {
    return { error: error instanceof ProfileError ? error.message : "Your profile could not be saved. Please try again." };
  }
  revalidatePath("/");
  return { success: "Your profile has been updated." };
}

export async function profileFieldAction(_state: { error?: string; saved?: string }, data: FormData): Promise<{ error?: string; saved?: string }> {
  const actor = await requireUser();
  const value = String(data.get("value") ?? "");
  try {
    await updateProfileField(actor, String(data.get("field") ?? ""), value);
  } catch (error) {
    return { error: error instanceof ProfileError ? error.message : "This detail could not be saved. Please try again." };
  }
  revalidatePath("/");
  return { saved: value };
}
