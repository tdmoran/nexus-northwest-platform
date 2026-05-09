-- AlterTable
ALTER TABLE "Member" ADD COLUMN "inviteSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_inviteSlug_key" ON "Member"("inviteSlug");
