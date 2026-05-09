-- AlterEnum
ALTER TYPE "AnnouncementStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "AnnouncementStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledFor_idx" ON "Announcement"("status", "scheduledFor");
