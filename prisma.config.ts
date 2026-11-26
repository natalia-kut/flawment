// Load the same root .env used by Next.js and Docker Compose.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection; hosted DATABASE_URL goes through a pooler.
    url: process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL"),
  },
});

