-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "outlookCalendarEventId" TEXT;

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_sentAt_idx" ON "email_logs"("sentAt");
