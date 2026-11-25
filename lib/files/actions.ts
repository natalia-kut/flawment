"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { deleteFile, FileError, recordId } from "./service";

export async function deleteFileAction(fileId: number): Promise<{ error?: string }> {
  const actor = await requireUser();
  try {
    await deleteFile(actor, recordId(String(fileId)));
    revalidatePath("/");
    return {};
  } catch (error) {
    return { error: error instanceof FileError ? error.message : "Could not delete the file. Please try again." };
  }
}
