"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { mutateStage, StageError } from "./service";

export type StageState = { error?: string; success?: boolean };
export async function stageAction(_state: StageState, data: FormData): Promise<StageState> {
  const actor = await requireUser();
  try {
    await mutateStage(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error instanceof StageError ? error.message : "Could not save the stage. Refresh and try again." };
  }
}
