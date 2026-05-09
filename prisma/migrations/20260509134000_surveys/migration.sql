-- AlterEnum
ALTER TYPE "TokenPurpose" ADD VALUE 'SURVEY_RESPONSE';

-- CreateTable
CREATE TABLE "EventSurvey" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dispatchedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventSurvey_eventId_key" ON "EventSurvey"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSurveyResponse_surveyId_memberId_key" ON "EventSurveyResponse"("surveyId", "memberId");

-- CreateIndex
CREATE INDEX "EventSurveyResponse_surveyId_idx" ON "EventSurveyResponse"("surveyId");

-- AddForeignKey
ALTER TABLE "EventSurvey" ADD CONSTRAINT "EventSurvey_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSurvey" ADD CONSTRAINT "EventSurvey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "OrganiserUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSurveyResponse" ADD CONSTRAINT "EventSurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "EventSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSurveyResponse" ADD CONSTRAINT "EventSurveyResponse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
