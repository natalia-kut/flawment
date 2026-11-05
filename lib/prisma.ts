import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/src/generated/prisma/client";

// Reuse the client only while its generated implementation remains current.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const cached = globalForPrisma.prisma;
function isCurrentClient(client: PrismaClient | undefined): boolean {
  return client instanceof PrismaClient && "projectStage" in client;
}
const compatible = isCurrentClient(cached);

export const prisma =
  cached && compatible
    ? cached
    : new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") {
  if (cached && !compatible) void cached.$disconnect().catch(() => {});
  globalForPrisma.prisma = prisma;
}
