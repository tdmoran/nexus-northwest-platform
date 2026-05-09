-- CreateTable
CREATE TABLE "ZohoSyncFailure" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoSyncFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZohoSyncFailure_memberId_key" ON "ZohoSyncFailure"("memberId");

-- CreateIndex
CREATE INDEX "ZohoSyncFailure_resolvedAt_idx" ON "ZohoSyncFailure"("resolvedAt");

-- AddForeignKey
ALTER TABLE "ZohoSyncFailure" ADD CONSTRAINT "ZohoSyncFailure_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
