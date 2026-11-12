-- Project specializations overlapped with job titles and skills, so they are removed.
ALTER TABLE "ProjectMembership" DROP CONSTRAINT "ProjectMembership_specialization_id_project_id_fkey";
ALTER TABLE "ProjectMembership" DROP COLUMN "specialization_id";
DROP TABLE "ProjectSpecialization";
