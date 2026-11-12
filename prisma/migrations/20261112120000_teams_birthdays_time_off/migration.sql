CREATE TYPE "AbsenceType" AS ENUM ('VACATION', 'SICK_LEAVE', 'BUSINESS_TRIP', 'OTHER');

CREATE TABLE "Team" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "name_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Team_name_key_key" ON "Team"("name_key");

ALTER TABLE "User" ADD COLUMN "birth_date" DATE,
  ADD COLUMN "team_id" INTEGER;
ALTER TABLE "User" ADD CONSTRAINT "User_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_team_id_idx" ON "User"("team_id");

CREATE TABLE "Absence" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "type" "AbsenceType" NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Absence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Absence_dates_check" CHECK ("end_date" >= "start_date")
);
CREATE INDEX "Absence_user_id_end_date_idx" ON "Absence"("user_id", "end_date");
