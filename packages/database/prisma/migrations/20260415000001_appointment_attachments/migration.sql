-- CreateTable
CREATE TABLE "appointment_attachments" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_attachments_appointmentId_idx" ON "appointment_attachments"("appointmentId");

-- AddForeignKey
ALTER TABLE "appointment_attachments" ADD CONSTRAINT "appointment_attachments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
