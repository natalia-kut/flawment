import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "./password";
type AuthResult = { error: string; userId?: never } | { userId: number; error?: never };
const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
// The dummy hash keeps unknown-account login attempts on the same expensive password path.
const dummyHash = `scrypt$${"0".repeat(32)}$${"0".repeat(64)}`;

export async function registerAccount(data: FormData): Promise<AuthResult> {
  const username = text(data, "username").toLowerCase();
  const email = text(data, "email").toLowerCase();
  const first_name = text(data, "first_name");
  const last_name = text(data, "last_name");
  const password = String(data.get("password") ?? "");
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) return { error: "Username must be 3–40 letters, numbers, dots, underscores or hyphens." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!first_name || !last_name || first_name.length > 80 || last_name.length > 80) return { error: "Enter your first and last name (up to 80 characters each)." };
  if (password.length < 10 || password.length > 128) return { error: "Use a password between 10 and 128 characters." };
  if (password !== String(data.get("confirm_password") ?? "")) return { error: "Passwords do not match." };
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { username: { equals: username, mode: "insensitive" } }] } });
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

export async function authenticate(data: FormData): Promise<AuthResult> {
  const email = text(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 128) return { error: "Enter your email address and password." };
  const key = createHash("sha256").update(email).digest("hex");
  const now = new Date();
  await prisma.loginAttempt.deleteMany({ where: { expires_at: { lte: now } } });
  const attempt = await prisma.loginAttempt.upsert({ where: { key },
    create: { key, expires_at: new Date(now.getTime() + 15 * 60_000) }, update: { count: { increment: 1 } } });
  if (attempt.count > 10) return { error: "Too many login attempts. Try again in 15 minutes." };
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const valid = await verifyPassword(password, user?.password ?? dummyHash);
  if (!user || !valid || !user.is_active) return { error: "Invalid email address or password." };
  await prisma.loginAttempt.deleteMany({ where: { key } });
  return { userId: user.id };
}
