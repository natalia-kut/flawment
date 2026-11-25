-- When a task was completed. Tasks completed earlier keep no date: it cannot be known.
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completed_at" TIMESTAMP(3);
