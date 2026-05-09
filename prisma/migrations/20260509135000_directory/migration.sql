-- AlterTable
ALTER TABLE "Member"
  ADD COLUMN "publicProfile" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "bio" TEXT;

-- CreateIndex
CREATE INDEX "Member_publicProfile_idx" ON "Member"("publicProfile");
