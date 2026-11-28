"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actionError } from "@/lib/action-error";
import { ApiTokenError, createApiToken, deleteAllApiTokens, deleteApiToken } from "./api-tokens";
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
  const revoked = await deleteAllApiTokens(user.id);
  if (revoked) revalidatePath("/");
  const parts = [
    ended && `signed out on ${ended} other ${ended === 1 ? "device" : "devices"}`,
    revoked && `${revoked} access ${revoked === 1 ? "token was" : "tokens were"} revoked`,
  ].filter(Boolean);
  return { message: parts.length ? `Password changed: ${parts.join(", and ")}.` : "Password changed." };
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

export type ApiTokenState = { error?: string; token?: string };

/** Creates an access token; the answer carries it in full, the only time it is shown. */
export async function createApiTokenAction(_state: ApiTokenState, data: FormData): Promise<ApiTokenState> {
  const user = await currentUser();
  if (!user) return { error: SESSION_ENDED };
  try {
    const { token } = await createApiToken(user.id, data);
    revalidatePath("/");
    return { token };
  } catch (error) {
    return { error: actionError(error, ApiTokenError, "The token could not be created. Please try again.") };
  }
}

/** Revokes one of your access tokens: tools using it stop working at once. */
export async function deleteApiTokenAction(id: number): Promise<{ error?: string }> {
  const user = await currentUser();
  if (!user) return { error: SESSION_ENDED };
  if (!Number.isInteger(id)) return { error: "This token no longer exists." };
  await deleteApiToken(user.id, id);
  revalidatePath("/");
  return {};
}
