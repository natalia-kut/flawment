CREATE TABLE "ProjectStage" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deadline" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectStage_project_id_name_key" ON "ProjectStage"("project_id", "name");
CREATE INDEX "ProjectStage_project_id_idx" ON "ProjectStage"("project_id");
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD COLUMN "stage_id" INTEGER;
CREATE INDEX "Task_stage_id_idx" ON "Task"("stage_id");
ALTER TABLE "Task" ADD CONSTRAINT "Task_stage_id_fkey"
  FOREIGN KEY ("stage_id") REFERENCES "ProjectStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
