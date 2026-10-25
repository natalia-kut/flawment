"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createTask, TaskError } from "./service";

export type TaskState = { error?: string; success?: boolean };

export async function createTaskAction(_state: TaskState, data: FormData): Promise<TaskState> {
  const actor = await requireUser();
  try {
    await createTask(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error instanceof TaskError ? error.message : "Could not save the task. Please try again." };
  }
}
