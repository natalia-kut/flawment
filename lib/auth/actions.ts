"use server";

import { redirect } from "next/navigation";
import { registerAccount, authenticate, changePassword } from "./service";
import { createSession, currentSessionHash, currentUser, deleteSession, endOtherSessions, SESSION_ENDED } from "./session";
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

export type PasswordState = { error?: string; message?: string };

/** Changes your password, and signs you out on every other device: whoever knew the old one is out. */
export async function changePasswordAction(_state: PasswordState, data: FormData): Promise<PasswordState> {
  const user = await currentUser();
  if (!user) return { error: SESSION_ENDED };
  const result = await changePassword(user.id, data);
  if ("error" in result) return { error: result.error };
  const ended = await endOtherSessions(user.id, await currentSessionHash());
  return { message: ended ? `Password changed. You were signed out on ${ended} other ${ended === 1 ? "device" : "devices"}.` : "Password changed." };
}

/** Signs you out everywhere but here: a lost phone, a shared computer. */
export async function endOtherSessionsAction(): Promise<PasswordState> {
  const user = await currentUser();
  if (!user) return { error: SESSION_ENDED };
  const ended = await endOtherSessions(user.id, await currentSessionHash());
  return { message: ended ? `Signed out on ${ended} other ${ended === 1 ? "device" : "devices"}.` : "You were not signed in anywhere else." };
}

/** Ends this session. The page then loads /login afresh, so nothing of the account stays in it. */
export async function logout() {
  await deleteSession();
}
