import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function main() {
  if (process.env.NODE_ENV === "production" && (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD)) {
    throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before seeding in production.");
  }
  const email = (process.env.SUPER_ADMIN_EMAIL || "admin@flawment.local").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "FlawmentAdmin123!";
  if (password.length < 10 || password.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid super admin credentials.");
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { username: { equals: "superadmin", mode: "insensitive" } }] } });
  if (existing) {
    if (existing.email.toLowerCase() !== email || existing.role !== "SUPER_ADMIN") throw new Error("Super admin email or username belongs to another account. Choose an unused email and resolve the username collision manually.");
    console.log("Super admin already exists; keeping its password and profile.");
    return;
  }
  await prisma.user.create({ data: { email, username: "superadmin", password: await hashPassword(password), first_name: "Super", last_name: "Admin", role: "SUPER_ADMIN" } });
  console.log(`Created super admin: ${email}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
