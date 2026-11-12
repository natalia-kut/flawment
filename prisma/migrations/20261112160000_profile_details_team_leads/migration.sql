ALTER TABLE "User" ADD COLUMN "team_lead" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "job_title" TEXT,
  ADD COLUMN "pronouns" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "working_hours" TEXT,
  ADD COLUMN "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
