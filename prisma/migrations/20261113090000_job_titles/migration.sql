CREATE TABLE "JobTitle" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "name_key" TEXT NOT NULL,
  "can_lead" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "JobTitle_name_key_key" ON "JobTitle"("name_key");

-- Turn the free-text titles into list entries; managers and leads may lead teams.
INSERT INTO "JobTitle" ("name", "name_key", "can_lead")
SELECT DISTINCT ON (lower(trim("job_title"))) trim("job_title"), lower(trim("job_title")),
  lower("job_title") LIKE '%manager%' OR lower("job_title") LIKE '%lead%'
FROM "User" WHERE trim(coalesce("job_title", '')) <> ''
ORDER BY lower(trim("job_title")), "id";

ALTER TABLE "User" ADD COLUMN "job_title_id" INTEGER;
UPDATE "User" u SET "job_title_id" = j."id" FROM "JobTitle" j WHERE j."name_key" = lower(trim(u."job_title"));
-- A lead whose title cannot lead is no longer one.
UPDATE "User" u SET "team_lead" = false
WHERE u."team_lead" AND NOT EXISTS (SELECT 1 FROM "JobTitle" j WHERE j."id" = u."job_title_id" AND j."can_lead");
ALTER TABLE "User" DROP COLUMN "job_title";
ALTER TABLE "User" ADD CONSTRAINT "User_job_title_id_fkey"
  FOREIGN KEY ("job_title_id") REFERENCES "JobTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_job_title_id_idx" ON "User"("job_title_id");
