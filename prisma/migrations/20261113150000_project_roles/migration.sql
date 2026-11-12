-- Project roles become Owner / Coordinator / Contributor.
-- The project's owner is its Owner; former admins and managers coordinate; participants contribute.
ALTER TABLE "ProjectMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "ProjectMembership" ALTER COLUMN "role" TYPE TEXT;
UPDATE "ProjectMembership" m SET "role" = CASE
  WHEN p."owner_id" = m."user_id" THEN 'OWNER'
  WHEN m."role" IN ('ADMIN', 'MANAGER') THEN 'COORDINATOR'
  ELSE 'CONTRIBUTOR' END
FROM "Project" p WHERE p."id" = m."project_id";
DROP TYPE "ProjectRole";
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'COORDINATOR', 'CONTRIBUTOR');
ALTER TABLE "ProjectMembership" ALTER COLUMN "role" TYPE "ProjectRole" USING "role"::"ProjectRole";
ALTER TABLE "ProjectMembership" ALTER COLUMN "role" SET DEFAULT 'CONTRIBUTOR';
