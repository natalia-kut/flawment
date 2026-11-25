-- Files attached to tasks, kept in the database like profile photos.
-- CreateTable
CREATE TABLE "TaskFile" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "uploader_id" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "thumbnail" BYTEA,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskFile_task_id_created_at_idx" ON "TaskFile"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "TaskFile_uploader_id_idx" ON "TaskFile"("uploader_id");

-- AddForeignKey
ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
