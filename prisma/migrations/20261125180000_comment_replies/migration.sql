-- Replies to comments. A deleted comment that has replies stays as an empty placeholder.
-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "parent_id" INTEGER;

-- CreateIndex
CREATE INDEX "TaskComment_parent_id_idx" ON "TaskComment"("parent_id");

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
