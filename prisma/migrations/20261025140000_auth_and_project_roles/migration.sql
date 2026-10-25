CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPER_ADMIN');
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
CREATE UNIQUE INDEX "User_email_case_insensitive_key" ON "User" (lower("email"));
CREATE UNIQUE INDEX "User_username_case_insensitive_key" ON "User" (lower("username"));
CREATE TABLE "Session" (
  "token_hash" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");
CREATE INDEX "Session_expires_at_idx" ON "Session"("expires_at");
CREATE TABLE "LoginAttempt" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "DocumentTemplate" ADD COLUMN "owner_id" INTEGER REFERENCES "User"("id") ON DELETE CASCADE;
-- Existing owners get the same explicit membership as newly created projects.
INSERT INTO "ProjectMembership" ("project_id", "user_id", "role")
SELECT "id", "owner_id", 'ADMIN'::"ProjectRole" FROM "Project"
ON CONFLICT ("project_id", "user_id") DO UPDATE SET "role" = 'ADMIN';
