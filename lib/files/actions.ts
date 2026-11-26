"use server";

import { revalidatePath } from "next/cache";
import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { deleteFile, FileError, recordId } from "./service";

export async function deleteFileAction(fileId: number): Promise<{ error?: string }> {
  // Not requireUser: its redirect to /login would throw away what the person was editing.
  const actor = await currentUser();
  if (!actor) return { error: SESSION_ENDED };
  try {
    await deleteFile(actor, recordId(String(fileId)));
    revalidatePath("/");
    return {};
  } catch (error) {
    return { error: error instanceof FileError ? error.message : "Could not delete the file. Please try again." };
  }
}
