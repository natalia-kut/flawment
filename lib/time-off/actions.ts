"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { mutateTimeOff, TimeOffError } from "./service";
import { workspaceToday } from "./dates";

export type TimeOffState = { error?: string; success?: string };

export async function timeOffAction(_state: TimeOffState, data: FormData): Promise<TimeOffState> {
  const actor = await requireUser();
  try {
    await mutateTimeOff(actor, data, workspaceToday());
  } catch (error) {
    return { error: error instanceof TimeOffError ? error.message : "Your time off could not be saved. Please try again." };
  }
  revalidatePath("/");
  return { success: data.get("operation") === "delete" ? "Time off removed." : "Time off added." };
}
