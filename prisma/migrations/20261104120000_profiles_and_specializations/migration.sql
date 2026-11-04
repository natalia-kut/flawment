ALTER TABLE "User" ADD COLUMN "description" TEXT,
  ADD COLUMN "photo" BYTEA,
  ADD COLUMN "photo_updated_at" TIMESTAMP(3);

CREATE TABLE "ProjectSpecialization" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "name_key" TEXT NOT NULL
);
CREATE UNIQUE INDEX "ProjectSpecialization_id_project_id_key" ON "ProjectSpecialization"("id", "project_id");
CREATE UNIQUE INDEX "ProjectSpecialization_project_id_name_key_key" ON "ProjectSpecialization"("project_id", "name_key");
ALTER TABLE "ProjectMembership" ADD COLUMN "specialization_id" INTEGER;
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_specialization_id_project_id_fkey"
  FOREIGN KEY ("specialization_id", "project_id") REFERENCES "ProjectSpecialization"("id", "project_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
