"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createTask, updateTask, deleteTask, TaskError } from "./service";

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

export async function updateTaskAction(_state: TaskState, data: FormData): Promise<TaskState> {
  const actor = await requireUser();
  try {
    await updateTask(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error instanceof TaskError ? error.message : "Could not update the task. Please try again." };
  }
}

export async function deleteTaskAction(_state: TaskState, data: FormData): Promise<TaskState> {
  const actor = await requireUser();
  try {
    await deleteTask(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error instanceof TaskError ? error.message : "Could not delete the task. Please try again." };
  }
}
