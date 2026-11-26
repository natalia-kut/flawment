"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createTask, updateTask, patchTask, deleteTask, changeTaskStatus, TaskConflictError, TaskError } from "./service";
import { addComment, editComment, deleteComment } from "./comments";

/** `conflict`: the page was out of date, and has been refreshed. */
export type TaskState = { error?: string; success?: boolean; conflict?: boolean };

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
    // The page may be out of date (a conflict, a deleted task): show what is saved now.
    revalidatePath("/");
    return { error: error instanceof TaskError ? error.message : "Could not update the task. Please try again.", conflict: error instanceof TaskConflictError };
  }
}

export async function patchTaskAction(data: FormData): Promise<TaskState> {
  const actor = await requireUser();
  try {
    await patchTask(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    revalidatePath("/");
    return { error: error instanceof TaskError ? error.message : "Could not save the change. Please try again.", conflict: error instanceof TaskConflictError };
  }
}

const commentOperations = { add: addComment, edit: editComment, delete: deleteComment };

export async function commentAction(operation: keyof typeof commentOperations, data: FormData): Promise<TaskState> {
  const actor = await requireUser();
  try {
    if (!Object.hasOwn(commentOperations, operation)) throw new TaskError("Unknown comment operation.");
    await commentOperations[operation](actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error instanceof TaskError ? error.message : "Could not save the comment. Please try again." };
  }
}

export async function deleteTaskAction(_state: TaskState, data: FormData): Promise<TaskState> {
  const actor = await requireUser();
  try {
    await deleteTask(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    revalidatePath("/");
    return { error: error instanceof TaskError ? error.message : "Could not delete the task. Please try again." };
  }
}

export async function changeTaskStatusAction(data: FormData): Promise<TaskState> {
  const actor = await requireUser();
  try {
    await changeTaskStatus(actor, data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    revalidatePath("/");
    return { error: error instanceof TaskError ? error.message : "Could not move the task. Refresh and try again." };
  }
}
