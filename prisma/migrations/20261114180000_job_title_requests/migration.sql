-- Team leads ask a super admin to change a team member's job title.
-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "JobTitleRequest" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "requested_by" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by" INTEGER,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTitleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobTitleRequest_status_idx" ON "JobTitleRequest"("status");

-- CreateIndex
CREATE INDEX "JobTitleRequest_user_id_idx" ON "JobTitleRequest"("user_id");

-- CreateIndex
CREATE INDEX "JobTitleRequest_requested_by_decided_at_idx" ON "JobTitleRequest"("requested_by", "decided_at");

-- AddForeignKey
ALTER TABLE "JobTitleRequest" ADD CONSTRAINT "JobTitleRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTitleRequest" ADD CONSTRAINT "JobTitleRequest_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTitleRequest" ADD CONSTRAINT "JobTitleRequest_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
