import "dotenv/config";
import { prisma } from "../lib/prisma";
import { applyDemo } from "./demo/apply";

// npm run db:demo: brings the sample projects up to date with today. It resets their tasks' status, dates,
// people and priority, so do not run it on a workspace where they became real work.
applyDemo()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
