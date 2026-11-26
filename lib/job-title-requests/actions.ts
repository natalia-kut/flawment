"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { mutateTitleRequest, TitleRequestError } from "./service";
import { actionError } from "@/lib/action-error";

export type TitleRequestState = { error?: string; success?: boolean };

export async function titleRequestAction(_state: TitleRequestState, data: FormData): Promise<TitleRequestState> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await mutateTitleRequest(actor, data);
  } catch (error) {
    // The page may be out of date (a changed or already decided request): show what is saved now.
    revalidatePath("/");
    return { error: actionError(error, TitleRequestError, "The request could not be saved. Refresh and try again.") };
  }
  revalidatePath("/");
  return { success: true };
}
