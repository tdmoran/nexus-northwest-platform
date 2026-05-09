-- AlterTable
ALTER TABLE "Member"
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex (so the hard-delete cron can find rows efficiently)
CREATE INDEX "Member_deletionRequestedAt_idx" ON "Member"("deletionRequestedAt");
CREATE INDEX "Member_deletedAt_idx" ON "Member"("deletedAt");
