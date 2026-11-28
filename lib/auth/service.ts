import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "./password";
import { isValidName, NAME_RULE } from "./names";
import { isValidEmail } from "./email";
import { cleanLine } from "@/lib/text";
type AuthResult = { error: string; userId?: never } | { userId: number; error?: never };
const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
// Emails and usernames are stored lower-cased (here, in updatePerson and in the
// seeds), so an exact comparison is a case-insensitive one. Prisma's
// `mode: "insensitive"` would be an ILIKE, where `_` and `%` are wildcards.
// The dummy hash keeps unknown-account login attempts on the same expensive password path.
const dummyHash = `scrypt$${"0".repeat(32)}$${"0".repeat(64)}`;

export async function registerAccount(data: FormData): Promise<AuthResult> {
  // Server actions can be called with anything, not only the form.
  if (!(data instanceof FormData)) return { error: "Fill in the form and try again." };
  const username = text(data, "username").toLowerCase();
  const email = text(data, "email").toLowerCase();
  const first_name = cleanLine(text(data, "first_name"));
  const last_name = cleanLine(text(data, "last_name"));
  const password = String(data.get("password") ?? "");
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) return { error: "Username must be 3–40 letters, numbers, dots, underscores or hyphens." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (!first_name || !last_name || first_name.length > 80 || last_name.length > 80) return { error: "Enter your first and last name (up to 80 characters each)." };
  if (!isValidName(first_name) || !isValidName(last_name)) return { error: NAME_RULE };
  if (password.length < 10 || password.length > 128) return { error: "Use a password between 10 and 128 characters." };
  if (password !== String(data.get("confirm_password") ?? "")) return { error: "Passwords do not match." };
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) return { error: "That email address or username is already registered." };
  let user;
  try {
    user = await prisma.user.create({ data: { username, email, first_name, last_name, password: await hashPassword(password), role: "USER" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { error: "That email address or username is already registered." };
    throw error;
  }
  return { userId: user.id };
}

/**
 * A signed-in person changes their own password: the current one first (wrong guesses
 * count like failed logins, so a borrowed open session cannot try password after password).
 */
export async function changePassword(userId: number, data: FormData): Promise<{ error: string } | { ok: true }> {
  if (!(data instanceof FormData)) return { error: "Fill in the form and try again." };
  const current = String(data.get("current_password") ?? "");
  const next = String(data.get("new_password") ?? "");
  if (!current) return { error: "Enter your current password." };
  if (next.length < 10 || next.length > 128) return { error: "Use a new password between 10 and 128 characters." };
  if (next !== String(data.get("confirm_password") ?? "")) return { error: "The new passwords do not match." };
  if (next === current) return { error: "Choose a new password that differs from the current one." };
  const key = createHash("sha256").update("password-change:" + userId).digest("hex");
  const now = new Date();
  await prisma.loginAttempt.deleteMany({ where: { expires_at: { lte: now } } });
  const attempt = await prisma.loginAttempt.upsert({ where: { key },
    create: { key, expires_at: new Date(now.getTime() + 15 * 60_000) }, update: { count: { increment: 1 } } });
  if (attempt.count > 10) return { error: "Too many attempts. Try again in a few minutes." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true, is_active: true } });
  if (!user?.is_active || !await verifyPassword(current, user.password)) return { error: "Your current password is not correct." };
  await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(next) } });
  await prisma.loginAttempt.deleteMany({ where: { key } });
  return { ok: true };
}

export async function authenticate(data: FormData): Promise<AuthResult> {
  if (!(data instanceof FormData)) return { error: "Enter your email address and password." };
  const email = text(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  if (!isValidEmail(email) || !password || password.length > 128) return { error: "Enter your email address and password." };
  const key = createHash("sha256").update(email).digest("hex");
  const now = new Date();
  await prisma.loginAttempt.deleteMany({ where: { expires_at: { lte: now } } });
  const attempt = await prisma.loginAttempt.upsert({ where: { key },
    create: { key, expires_at: new Date(now.getTime() + 15 * 60_000) }, update: { count: { increment: 1 } } });
  if (attempt.count > 10) {
    // The window opens at the first attempt, so the wait is what is left of it.
    const minutes = Math.max(1, Math.ceil((attempt.expires_at.getTime() - now.getTime()) / 60_000));
    return { error: `Too many login attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.` };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.password ?? dummyHash);
  if (!user || !valid || !user.is_active) return { error: "Invalid email address or password." };
  await prisma.loginAttempt.deleteMany({ where: { key } });
  return { userId: user.id };
}
