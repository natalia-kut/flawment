"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { setStatus, StatusError } from "./service";

export type StatusState = { error?: string; success?: boolean };

export async function statusAction(_state: StatusState, data: FormData): Promise<StatusState> {
  const actor = await requireUser();
  try {
    await setStatus(actor, data);
  } catch (error) {
    return { error: error instanceof StatusError ? error.message : "Your status could not be saved. Please try again." };
  }
  revalidatePath("/");
  return { success: true };
}
