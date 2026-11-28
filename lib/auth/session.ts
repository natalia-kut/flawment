import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authHref } from "./return-path";

const cookieName = "flawment_session";
const lifetime = 60 * 60 * 24 * 7;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const userSelect = { id: true, username: true, first_name: true, last_name: true, role: true, photo_updated_at: true } as const;

export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma.session.findUnique({
    where: { token_hash: digest(token) },
    include: { user: { select: { ...userSelect, is_active: true } } },
  });
  if (!session || session.expires_at <= new Date() || !session.user.is_active) return null;
  const { id, username, first_name, last_name, role, photo_updated_at } = session.user;
  return { id, username, first_name, last_name, role, photoVersion: photo_updated_at?.toISOString() ?? null };
}

/** What a server action says when the session ended while the page was open. */
export const SESSION_ENDED = "Your session has ended, so this was not saved. Your text is still here: sign in again in another tab, then try again.";

/**
 * The signed-in user, or a redirect to /login. A page passes its own address as
 * `returnTo`, so signing in leads back to it (a shared `/?task=12` link).
 */
export async function requireUser(returnTo?: string) {
  const user = await currentUser();
  if (!user) redirect(returnTo ? authHref("/login", returnTo) : "/login");
  return user;
}

export async function createSession(userId: number) {
  await deleteSession();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + lifetime * 1000);
  await prisma.session.deleteMany({ where: { expires_at: { lt: new Date() } } });
  await prisma.session.create({ data: { token_hash: digest(token), user_id: userId, expires_at: expires } });
  (await cookies()).set(cookieName, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires,
  });
}

/** The current session's token, hashed as stored, so it can be told apart from the others. */
export async function currentSessionHash() {
  const token = (await cookies()).get(cookieName)?.value;
  return token ? digest(token) : null;
}

/** Signs a person out everywhere except the session `keep` (this browser). */
export async function endOtherSessions(userId: number, keep: string | null) {
  const { count } = await prisma.session.deleteMany({ where: { user_id: userId, ...(keep ? { token_hash: { not: keep } } : {}) } });
  return count;
}

export async function deleteSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await prisma.session.deleteMany({ where: { token_hash: digest(token) } });
  jar.delete(cookieName);
}
