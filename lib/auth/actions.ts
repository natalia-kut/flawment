"use server";

import { redirect } from "next/navigation";
import { registerAccount, authenticate } from "./service";
import { createSession, deleteSession } from "./session";
import { safeReturnPath } from "./return-path";

export type AuthState = { error?: string };
export async function register(_state: AuthState, data: FormData): Promise<AuthState> {
  const result = await registerAccount(data);
  if (result.error !== undefined) return { error: result.error };
  await createSession(result.userId);
  redirect(safeReturnPath(data.get("next")));
}

export async function login(_state: AuthState, data: FormData): Promise<AuthState> {
  const result = await authenticate(data);
  if (result.error !== undefined) return { error: result.error };
  await createSession(result.userId);
  redirect(safeReturnPath(data.get("next")));
}

/** Ends this session. The page then loads /login afresh, so nothing of the account stays in it. */
export async function logout() {
  await deleteSession();
}
