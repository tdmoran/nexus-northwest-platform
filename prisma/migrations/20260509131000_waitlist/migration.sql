-- AlterEnum
ALTER TYPE "RSVPStatus" ADD VALUE 'WAITLISTED';

-- AlterTable
ALTER TABLE "RSVP"
  ADD COLUMN "waitlistedAt" TIMESTAMP(3),
  ADD COLUMN "promotedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RSVP_eventId_status_waitlistedAt_idx" ON "RSVP"("eventId", "status", "waitlistedAt");
