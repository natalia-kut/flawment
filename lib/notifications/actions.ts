"use server";

import { currentUser, SESSION_ENDED } from "@/lib/auth/session";
import { markNotificationsRead } from "./data";

/** Marks the given notifications read, or "all" of them. */
export async function markReadAction(ids: number[] | "all"): Promise<{ error?: string }> {
  const user = await currentUser();
  if (!user) return { error: SESSION_ENDED };
  if (ids !== "all" && (!Array.isArray(ids) || ids.length > 100 || !ids.every(Number.isSafeInteger))) return { error: "Invalid notifications." };
  await markNotificationsRead(user.id, ids);
  return {};
}
