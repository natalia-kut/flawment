"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { mutateTeam, TeamError } from "./service";

export type TeamState = { error?: string; success?: string };

export async function teamAction(_state: TeamState, data: FormData): Promise<TeamState> {
  const actor = await requireUser();
  try {
    await mutateTeam(actor, data);
  } catch (error) {
    return { error: error instanceof TeamError ? error.message : "The team could not be saved. Refresh and try again." };
  }
  revalidatePath("/");
  return { success: "Teams updated." };
}
