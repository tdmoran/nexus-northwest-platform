-- CreateEnum
CREATE TYPE "SeriesCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cadence" "SeriesCadence" NOT NULL,
    "startTimeLocal" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 120,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Dublin',
    "location" TEXT NOT NULL,
    "onlineUrl" TEXT,
    "heroImageUrl" TEXT,
    "capacity" INTEGER,
    "reminderOffsets" INTEGER[] DEFAULT ARRAY[10080, 1440, 120]::INTEGER[],
    "reminderAudience" TEXT NOT NULL DEFAULT 'all',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "lookaheadCount" INTEGER NOT NULL DEFAULT 2,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "seriesId" TEXT;

-- CreateIndex
CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "OrganiserUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
