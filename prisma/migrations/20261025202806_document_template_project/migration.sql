-- DropForeignKey
ALTER TABLE "DocumentTemplate" DROP CONSTRAINT "DocumentTemplate_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_user_id_fkey";

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "project_id" INTEGER,
ADD COLUMN     "show_name" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_status" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "DocumentTemplate_owner_id_idx" ON "DocumentTemplate"("owner_id");

-- CreateIndex
CREATE INDEX "DocumentTemplate_project_id_idx" ON "DocumentTemplate"("project_id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
