"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { mutateTitleRequest, TitleRequestError } from "./service";

export type TitleRequestState = { error?: string; success?: boolean };

export async function titleRequestAction(_state: TitleRequestState, data: FormData): Promise<TitleRequestState> {
  const actor = await requireUser();
  try {
    await mutateTitleRequest(actor, data);
  } catch (error) {
    return { error: error instanceof TitleRequestError ? error.message : "The request could not be saved. Refresh and try again." };
  }
  revalidatePath("/");
  return { success: true };
}
