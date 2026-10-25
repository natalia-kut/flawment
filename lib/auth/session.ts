import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const cookieName = "flawment_session";
const lifetime = 60 * 60 * 24 * 7;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const userSelect = { id: true, username: true, first_name: true, last_name: true, role: true } as const;

export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma.session.findUnique({
    where: { token_hash: digest(token) },
    include: { user: { select: { ...userSelect, is_active: true } } },
  });
  if (!session || session.expires_at <= new Date() || !session.user.is_active) return null;
  const { id, username, first_name, last_name, role } = session.user;
  return { id, username, first_name, last_name, role };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
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

export async function deleteSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await prisma.session.deleteMany({ where: { token_hash: digest(token) } });
  jar.delete(cookieName);
}
